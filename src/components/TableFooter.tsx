"use client";

import { formatNumber } from "@/lib/format";

interface Props {
  shown: number;
  total: number;
  onMore: () => void;
  step: number;
}

export default function TableFooter({ shown, total, onMore, step }: Props) {
  return (
    <div className="table-footer">
      <span>
        显示 {formatNumber(shown)} / {formatNumber(total)} 条
      </span>
      {shown < total && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onMore}>
          再加载 {Math.min(step, total - shown)} 条
        </button>
      )}
    </div>
  );
}
