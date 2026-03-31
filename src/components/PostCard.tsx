"use client";

import { motion } from "framer-motion";
import moment from "moment";

interface Post {
  id: string;
  content: string;
  created_at: string;
  author_email?: string;
}

interface PostCardProps {
  post: Post;
  index?: number;
}

export default function PostCard({ post, index = 0 }: PostCardProps) {
  const initials = post.author_email
    ? post.author_email.slice(0, 2).toUpperCase()
    : "??";

  const displayEmail = post.author_email
    ? post.author_email.length > 24
      ? post.author_email.slice(0, 24) + "…"
      : post.author_email
    : "Anonymous";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-brand-yellow flex items-center justify-center text-xs font-medium text-gray-900 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-normal text-gray-900 truncate">
            {displayEmail}
          </p>
          <p className="text-xs text-gray-400">
            {moment(post.created_at).fromNow()}
          </p>
        </div>
      </div>
      <p className="text-gray-800 text-sm leading-relaxed line-clamp-4">
        {post.content}
      </p>
    </motion.article>
  );
}
