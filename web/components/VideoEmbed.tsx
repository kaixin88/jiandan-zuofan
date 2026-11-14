export default function VideoEmbed({ url }: { url: string }) {
  const m = url.match(/BV[0-9A-Za-z]+/);
  if (!m) return null;
  const src = `https://player.bilibili.com/player.html?bvid=${m[0]}&page=1`;
  return (
    <div className="video-block">
      <p className="video-cap">参考视频</p>
      <div className="video">
        <iframe
          src={src}
          title="参考视频"
          allowFullScreen
          scrolling="no"
          frameBorder="0"
        />
      </div>
    </div>
  );
}
