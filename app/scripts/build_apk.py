# -*- coding: utf-8 -*-
"""
用本机 Android SDK 直接构建「简单做饭」APK（不需要 Gradle / Android Studio / 联网）。

流程：aapt2 compile → link → javac → d8 → 注入 classes.dex → zipalign → apksigner
运行：python app/scripts/build_apk.py
产物：app/dist/jiandan-zuofan-v1.0.0.apk
"""
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw

APP = Path(__file__).resolve().parents[1]
ANDROID = APP / "android"
BUILD = APP / "build" / "v1.4.0"
DIST = APP / "dist"
ASSETS = ANDROID / "assets"
WEBAPP = APP / "webapp"
RES = ANDROID / "res"
SRC_DIR = ANDROID / "src" / "app"
MANIFEST = ANDROID / "AndroidManifest.xml"

SDK = Path("G:/reverse/android")
BT = SDK / "build-tools" / "35.0.0"
JAR = SDK / "platforms" / "android-35" / "android.jar"
JDK = SDK / "jdk"

AAPT2 = BT / "aapt2.exe"
ZIPALIGN = BT / "zipalign.exe"
D8 = BT / "d8.bat"
APKSIGNER = BT / "apksigner.bat"
JAVAC = JDK / "bin" / "javac.exe"
KEYTOOL = JDK / "bin" / "keytool.exe"

APK_NAME = "jiandan-zuofan-v1.4.0.apk"
KEYSTORE = APP / "debug.keystore"


def env():
    e = os.environ.copy()
    e["JAVA_HOME"] = str(JDK)
    e["PATH"] = str(JDK / "bin") + os.pathsep + e.get("PATH", "")
    return e


def run(cmd, cwd=None):
    print("  >", " ".join(str(c) for c in cmd[:6]), "..." if len(cmd) > 6 else "")
    r = subprocess.run([str(c) for c in cmd], cwd=cwd, env=env(),
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, errors="replace")
    if r.returncode != 0:
        print(r.stdout[-4000:])
        raise SystemExit("命令失败：" + str(cmd[0]))
    if r.stdout.strip():
        print("   ", r.stdout.strip()[-600:])
    return r


def bat(bat_path, args):
    # Windows .bat 需要 cmd /c
    return run(["cmd", "/c", str(bat_path)] + [str(a) for a in args])


def make_icons():
    """使用原创快乐饭碗图标，输出各密度资源；保留原始设计文件。"""
    original = WEBAPP / "brand-icon.png"
    if not original.exists():
        raise SystemExit("缺少原创图标：" + str(original))
    sizes = {"mipmap-mdpi": 48, "mipmap-hdpi": 72, "mipmap-xhdpi": 96,
             "mipmap-xxhdpi": 144, "mipmap-xxxhdpi": 192}
    with Image.open(original) as image:
        image = image.convert("RGB")
        for folder, n in sizes.items():
            out = RES / folder / "ic_launcher.png"
            out.parent.mkdir(parents=True, exist_ok=True)
            image.resize((n, n), Image.Resampling.LANCZOS).save(out, "PNG", optimize=True)
    print("原创快乐饭碗图标已生成")


def prepare():
    # 增量更新资源，不批量删除旧 assets；独立版本构建目录避免与旧产物混用。
    for p in (BUILD, ASSETS):
        p.mkdir(parents=True, exist_ok=True)
    DIST.mkdir(parents=True, exist_ok=True)
    shutil.copytree(WEBAPP, ASSETS, dirs_exist_ok=True)
    make_icons()
    n = len(list(ASSETS.rglob("*")))
    print("assets 文件数：", n, " 体积：%.1f KB" % (
        sum(f.stat().st_size for f in ASSETS.rglob("*") if f.is_file()) / 1024))


def compile_resources():
    flat = BUILD / "flat"
    flat.mkdir(parents=True, exist_ok=True)
    files = [f for f in RES.rglob("*") if f.is_file()]
    for f in files:
        run([AAPT2, "compile", f, "-o", flat])
    print("资源编译：", len(files), "个文件")
    return sorted(flat.glob("*.flat"))


def link(flats):
    base = BUILD / "base.apk"
    cmd = [AAPT2, "link", "-o", base, "-I", JAR,
           "--manifest", MANIFEST,
           "--min-sdk-version", "24", "--target-sdk-version", "35",
           "--version-code", "5", "--version-name", "1.4.0",
           "-A", ASSETS, "--auto-add-overlay"]
    for f in flats:
        cmd += ["-R", f]
    run(cmd)
    return base


def compile_java():
    classes = BUILD / "classes"
    classes.mkdir(parents=True, exist_ok=True)
    java_files = sorted(SRC_DIR.glob("*.java"))
    run([JAVAC, "-source", "11", "-target", "11", "-encoding", "UTF-8",
         "-classpath", JAR, "-d", classes] + java_files)
    return sorted(classes.rglob("*.class"))


def dex(class_files):
    out = BUILD / "dex"
    out.mkdir(parents=True, exist_ok=True)
    bat(D8, ["--min-api", "24", "--lib", JAR, "--output", out] + class_files)
    f = out / "classes.dex"
    if not f.exists():
        raise SystemExit("classes.dex 未生成")
    return f


def inject_dex(base, dex_file):
    with zipfile.ZipFile(base, "a", zipfile.ZIP_DEFLATED) as z:
        z.write(dex_file, "classes.dex")
    return base


def align(base):
    aligned = BUILD / "aligned.apk"
    run([ZIPALIGN, "-p", "-f", "4", base, aligned])
    return aligned


def ensure_keystore():
    if KEYSTORE.exists():
        return
    run([KEYTOOL, "-genkeypair", "-keystore", KEYSTORE,
         "-storepass", "android", "-keypass", "android",
         "-alias", "androiddebugkey", "-keyalg", "RSA", "-keysize", "2048",
         "-validity", "10000",
         "-dname", "CN=Jiandan Zuofan, OU=Personal, O=Personal, L=Beijing, ST=Beijing, C=CN"])


def sign(aligned):
    out = DIST / APK_NAME
    if out.exists():
        out.unlink()
    bat(APKSIGNER, ["sign", "--ks", KEYSTORE,
                    "--ks-key-alias", "androiddebugkey",
                    "--ks-pass", "pass:android", "--key-pass", "pass:android",
                    "--v1-signing-enabled", "true", "--v2-signing-enabled", "true",
                    "--out", out, aligned])
    bat(APKSIGNER, ["verify", "--verbose", out])
    return out


def main():
    for p in (AAPT2, JAR, JAVAC, D8, APKSIGNER, ZIPALIGN, KEYTOOL):
        if not Path(p).exists():
            raise SystemExit("缺少工具：" + str(p))
    print("=== 1/7 准备 assets 与图标 ===")
    prepare()
    print("=== 2/7 编译资源 ===")
    flats = compile_resources()
    print("=== 3/7 链接 APK ===")
    base = link(flats)
    print("=== 4/7 编译 Java ===")
    classes = compile_java()
    print("=== 5/7 转 dex 并注入 ===")
    inject_dex(base, dex(classes))
    print("=== 6/7 对齐 ===")
    aligned = align(base)
    print("=== 7/7 签名 ===")
    ensure_keystore()
    apk = sign(aligned)
    with zipfile.ZipFile(apk) as z:
        names = z.namelist()
    print("\n构建完成：", apk)
    print("体积：%.2f MB" % (apk.stat().st_size / 1024 / 1024))
    print("包含 assets：%d 项，classes.dex：%s" % (
        sum(1 for n in names if n.startswith("assets/")), "classes.dex" in names))
    print("签名验证通过（详细签名方案见上方验证结果，可覆盖安装）")


if __name__ == "__main__":
    main()
