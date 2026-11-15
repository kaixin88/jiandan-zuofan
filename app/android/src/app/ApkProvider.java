package top.modianyu.jiandanzuofan;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;

/** 把下载到私有目录的更新包以 content:// 交给系统安装器（不依赖 AndroidX）。 */
public class ApkProvider extends ContentProvider {

    @Override
    public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File f = new File(dir, uri.getLastPathSegment());
        if (!f.exists()) throw new FileNotFoundException(f.getAbsolutePath());
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri u, String[] p, String s, String[] a, String o) { return null; }
    @Override public String getType(Uri u) { return "application/vnd.android.package-archive"; }
    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
