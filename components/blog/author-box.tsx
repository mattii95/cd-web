import type { PostAuthor } from "@/db/blog";
import { PersonAvatar } from "./person-avatar";

export function AuthorBox({ author }: { author: PostAuthor }) {
  return (
    <div className="fx-reveal flex flex-wrap items-center gap-[18px] rounded-[20px] border border-paper-border bg-white p-6">
      <PersonAvatar
        name={author.name}
        image={author.image}
        className="size-14 text-base"
      />
      <span className="flex flex-[1_1_260px] flex-col gap-1">
        <strong className="font-display text-lg">{author.name}</strong>
        {author.jobTitle && (
          <span className="text-sm font-medium text-accent">
            {author.jobTitle}
          </span>
        )}
        {author.bio && (
          <span className="text-[15px] leading-normal text-text-faint">
            {author.bio}
          </span>
        )}
      </span>
    </div>
  );
}
