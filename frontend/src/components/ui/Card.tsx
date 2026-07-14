import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
}

export default function Card({ children, className = "", padding = true, hover = false }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all duration-200
      ${hover ? "hover:shadow-md hover:-translate-y-0.5" : ""}
      dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/30
      ${padding ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}
