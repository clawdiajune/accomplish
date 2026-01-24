import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TodoItem } from '@accomplish/shared';

interface TodoInlineCardProps {
  todos: TodoItem[];
}

export function TodoInlineCard({ todos }: TodoInlineCardProps) {
  const completed = todos.filter(t => t.status === 'completed').length;
  const total = todos.length;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          Task Breakdown
        </span>
        <span className="text-xs text-muted-foreground">
          {completed}/{total}
        </span>
      </div>
      <ul className="space-y-1">
        {todos.map((todo) => (
          <li key={todo.id} className="flex items-start gap-2">
            <InlineStatusIcon status={todo.status} />
            <span
              className={cn(
                'text-xs text-foreground',
                todo.status === 'cancelled' && 'line-through text-muted-foreground'
              )}
            >
              {todo.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlineStatusIcon({ status }: { status: TodoItem['status'] }) {
  const iconClass = 'h-3 w-3 shrink-0 mt-0.5';
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={cn(iconClass, 'text-green-500')} />;
    case 'in_progress':
      return <Loader2 className={cn(iconClass, 'text-primary animate-spin')} />;
    case 'cancelled':
      return <XCircle className={cn(iconClass, 'text-muted-foreground')} />;
    case 'pending':
    default:
      return <Circle className={cn(iconClass, 'text-muted-foreground')} />;
  }
}
