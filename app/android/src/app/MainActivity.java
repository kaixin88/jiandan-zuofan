package top.modianyu.jiandanzuofan;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 简单做饭 —— 极简 WebView 壳。
 *
 * 内容：assets 内置首屏快照，联网后由前端同步网站 /app/ 数据。
 * 图片：APK 只内置前 N 张，其余由本类在后台【单线程串行】下载到私有目录，
 *       通过 https://img.local/{id}.webp 拦截返回本地文件；以后网站新增菜谱的图片自动进队列。
 *       不并发、不重试、不重复下载；每次入队最多补 MAX_PER_CALL 张，多次启动自然补齐。
 */
public class MainActivity extends Activity {

    private static final String IMG_HOST = "img.local";
    private static final int MAX_PER_CALL = 120;
    private static final String[] IMAGE_BASES = {
            "https://modianyu.top", "https://caipu-4h2.pages.dev"
    };
    private static final byte[] TRANSPARENT_PNG = Base64.decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==",
            Base64.DEFAULT);

    private WebView web;
    private long lastBackPressed = 0L;

    // B 站播放器全屏
    private View customView;
    private WebChromeClient.CustomViewCallback customCallback;
    private FrameLayout fullscreen;

    private File cacheDir;
    private final LinkedBlockingQueue<String> imageQueue = new LinkedBlockingQueue<String>();
    private final Set<String> seen = Collections.synchronizedSet(new HashSet<String>());
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private final ExecutorService imageWorker = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupBars();
        cacheDir = new File(getFilesDir(), "imgcache");
        cacheDir.mkdirs();

        web = new WebView(this);
        setContentView(web);
        configure(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    private void setupBars() {
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(Color.parseColor("#FFD43B"));
        w.setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            w.getDecorView().setSystemUiVisibility(
                    w.getDecorView().getSystemUiVisibility()
                            | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    /* ------------------------- JS 桥 ------------------------- */

    /** 外链（视频 / 返佣商品）交给系统浏览器 */
    @JavascriptInterface
    public void openUrl(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception ignored) { }
    }

    /* ------------------------- APK 自动更新 ------------------------- */

    private static final String APK_FILE = "jiandan-zuofan.apk";
    private static final String APK_AUTHORITY = "top.modianyu.jiandanzuofan.apk";

    /** 当前安装的 versionCode，前端用来和更新清单比对 */
    @JavascriptInterface
    public int getVersionCode() {
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.versionCode;
        } catch (Exception ignored) { return 0; }
    }

    /** 后台拉取 CNB 公开仓库的 update.json（Java 层请求，绕开 file:// 的 CORS） */
    @JavascriptInterface
    public void checkUpdate(final String url) {
        new Thread(new Runnable() {
            @Override public void run() {
                String body = null;
                HttpURLConnection conn = null;
                try {
                    conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.setRequestProperty("Accept", "application/json");
                    if (conn.getResponseCode() == 200) {
                        InputStream in = conn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buf = new byte[4096];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                        in.close();
                        body = out.toString("UTF-8");
                    }
                } catch (Exception ignored) { }
                finally { if (conn != null) conn.disconnect(); }
                if (body == null) return;   // 检查失败静默，不打扰用户
                final String result = body;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (web != null) web.evaluateJavascript(
                                "window.__onUpdateCheck&&window.__onUpdateCheck(" +
                                        JSONObject.quote(result) + ")", null);
                    }
                });
            }
        }, "update-check").start();
    }

    /** 下载 + sha256 校验 + 唤起系统安装器 */
    @JavascriptInterface
    public void installUpdate(final String url, final String expectSha) {
        runOnUiThread(new Runnable() {
            @Override public void run() {
                Toast.makeText(MainActivity.this, "正在下载更新…", Toast.LENGTH_SHORT).show();
            }
        });
        new Thread(new Runnable() {
            @Override public void run() {
                final boolean ok = downloadApk(url, expectSha);
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (ok) promptInstall();
                        else Toast.makeText(MainActivity.this, "更新下载失败，请稍后重试",
                                Toast.LENGTH_LONG).show();
                    }
                });
            }
        }, "update-download").start();
    }

    private boolean downloadApk(String url, String expectSha) {
        File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) return false;
        dir.mkdirs();
        File dest = new File(dir, APK_FILE);
        File tmp = new File(dir, APK_FILE + ".tmp");
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(20000);
            conn.setInstanceFollowRedirects(true);
            if (conn.getResponseCode() != 200) return false;
            InputStream in = conn.getInputStream();
            FileOutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            out.close();
            in.close();
            if (expectSha != null && expectSha.length() > 0
                    && !sha256(tmp).equalsIgnoreCase(expectSha)) {
                tmp.delete();
                return false;
            }
            if (dest.exists()) dest.delete();
            return tmp.renameTo(dest);
        } catch (Exception ignored) {
            tmp.delete();
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        FileInputStream in = new FileInputStream(f);
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        in.close();
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format("%02x", b & 0xff));
        return sb.toString();
    }

    private void promptInstall() {
        Uri uri = new Uri.Builder().scheme("content")
                .authority(APK_AUTHORITY).appendPath(APK_FILE).build();
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try { startActivity(i); } catch (Exception ignored) { }
    }

    /** 前端启动时同步读取已缓存的图片 id 列表 */
    @JavascriptInterface
    public String getCachedIds() {
        JSONArray arr = new JSONArray();
        File[] fs = cacheDir.listFiles();
        if (fs != null) {
            for (File f : fs) {
                String n = f.getName();
                if (n.endsWith(".webp") && f.length() > 0) {
                    arr.put(n.substring(0, n.length() - 5));
                }
            }
        }
        return arr.toString();
    }

    /** 前端把「需要但本地还没有」的图片 id 交给后台队列 */
    @JavascriptInterface
    public void warmImages(String json) {
        try {
            JSONArray arr = new JSONArray(json);
            int added = 0;
            for (int i = 0; i < arr.length() && added < MAX_PER_CALL; i++) {
                String id = arr.getString(i);
                if (id == null || id.length() == 0 || seen.contains(id)) continue;
                File f = new File(cacheDir, id + ".webp");
                if (f.exists() && f.length() > 0) continue;
                seen.add(id);
                imageQueue.offer(id);
                added++;
            }
        } catch (Exception ignored) { }
        startImageWorker();
    }

    private void startImageWorker() {
        if (!downloading.compareAndSet(false, true)) return;
        imageWorker.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    String id;
                    while ((id = imageQueue.poll()) != null) {
                        File f = new File(cacheDir, id + ".webp");
                        if (f.exists() && f.length() > 0) continue;
                        if (downloadOne(id, f)) notifyImageReady(id);
                        // 失败不重试、不重复；下次启动由前端重新入队
                    }
                } finally {
                    downloading.set(false);
                    if (!imageQueue.isEmpty()) startImageWorker();
                }
            }
        });
    }

    /** 单张图片：主源失败换备用源一次，不重试同一地址 */
    private boolean downloadOne(String id, File dest) {
        for (String base : IMAGE_BASES) {
            HttpURLConnection conn = null;
            File tmp = new File(dest.getAbsolutePath() + ".tmp");
            try {
                conn = (HttpURLConnection) new URL(base + "/dishes/s/" + id + ".webp").openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setInstanceFollowRedirects(true);
                if (conn.getResponseCode() != 200) { tmp.delete(); continue; }
                InputStream in = conn.getInputStream();
                FileOutputStream out = new FileOutputStream(tmp);
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                out.close();
                in.close();
                if (tmp.length() > 512 && tmp.renameTo(dest)) return true;
                tmp.delete();
            } catch (Exception ignored) {
                tmp.delete();
            } finally {
                if (conn != null) conn.disconnect();
            }
        }
        return false;
    }

    private void notifyImageReady(final String id) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null) {
                    web.evaluateJavascript(
                            "window.__onImageReady&&window.__onImageReady(" + JSONObject.quote(id) + ")",
                            null);
                }
            }
        });
    }

    /* ------------------------- 视频全屏 ------------------------- */

    private void showCustomView(View view, WebChromeClient.CustomViewCallback callback) {
        if (customView != null) { callback.onCustomViewHidden(); return; }
        customView = view;
        customCallback = callback;
        if (fullscreen == null) {
            fullscreen = new FrameLayout(this);
            fullscreen.setBackgroundColor(Color.BLACK);
        }
        fullscreen.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(fullscreen);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    private void hideCustomView() {
        if (customView == null) return;
        fullscreen.removeView(customView);
        customView = null;
        setContentView(web);
        setupBars();
        if (customCallback != null) {
            try { customCallback.onCustomViewHidden(); } catch (Exception ignored) { }
            customCallback = null;
        }
    }

    /* ------------------------- WebView ------------------------- */

    private void configure(WebView v) {
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);

        v.addJavascriptInterface(this, "AndroidBridge");

        v.setWebViewClient(new WebViewClient() {
            private boolean external(String url) {
                if (url == null) return false;
                if (url.startsWith("file://") || url.startsWith("about:")
                        || url.startsWith("data:") || url.startsWith("javascript:")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return external(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return external(url);
            }

            /** 已缓存的图片直接返回本地文件；未缓存返回 1x1 透明图，等后台补齐后由 JS 刷新 */
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (IMG_HOST.equals(u.getHost())) {
                    String path = u.getPath();
                    if (path != null && path.endsWith(".webp")) {
                        String id = path.substring(1, path.length() - 5);
                        File f = new File(cacheDir, id + ".webp");
                        if (f.exists() && f.length() > 0) {
                            try {
                                return new WebResourceResponse("image/webp", null,
                                        new FileInputStream(f));
                            } catch (Exception ignored) { }
                        }
                    }
                    return new WebResourceResponse("image/png", null,
                            new ByteArrayInputStream(TRANSPARENT_PNG));
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
        v.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
                showCustomView(view, callback);
            }
            @Override
            public void onHideCustomView() {
                hideCustomView();
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (customView != null) { hideCustomView(); return; }  // 先退出视频全屏
        if (web != null && web.canGoBack()) {
            web.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPressed < 2000) {
            super.onBackPressed();
        } else {
            lastBackPressed = now;
            Toast.makeText(this, "再按一次退出", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onDestroy() {
        imageWorker.shutdownNow();
        super.onDestroy();
    }
}
