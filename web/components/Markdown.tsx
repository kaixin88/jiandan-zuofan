import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...props} loading="lazy" decoding="async" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
