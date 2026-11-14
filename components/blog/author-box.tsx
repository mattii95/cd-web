import { blogAuthor } from "@/lib/blog-posts";

export function AuthorBox() {
  return (
    <div className="fx-reveal flex flex-wrap items-center gap-[18px] rounded-[20px] border border-paper-border bg-white p-6">
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full bg-accent font-mono text-base font-semibold text-white"
      >
        {blogAuthor.initials}
      </span>
      <span className="flex flex-[1_1_260px] flex-col gap-1">
        <strong className="font-display text-lg">{blogAuthor.name}</strong>
        <span className="text-[15px] leading-normal text-text-faint">
          {blogAuthor.bio}
        </span>
      </span>
    </div>
  );
}
