import { forwardRef } from "react";
import { cn } from "../../utils/cn";
import { Inbox } from "lucide-react";

export const Table = forwardRef(
  ({ className, containerClassName, children, ...props }, ref) => (
    <div
      className={cn(
        "relative w-full overflow-x-auto rounded-xl border border-slate-800/70 bg-slate-900/50 backdrop-blur-md shadow-sm",
        containerClassName
      )}
    >
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm text-left border-collapse", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = forwardRef(({ className, children, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-slate-950/75 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider font-semibold select-none",
      className
    )}
    {...props}
  >
    {children}
  </thead>
));
TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef(({ className, children, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-slate-800/40 text-slate-200", className)}
    {...props}
  >
    {children}
  </tbody>
));
TableBody.displayName = "TableBody";

export const TableRow = forwardRef(
  ({ className, isSelected, isInteractive = true, striped = true, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "transition-colors duration-150 border-b border-slate-800/30 last:border-b-0",
        striped && "even:bg-white/[0.015]",
        isInteractive && "hover:bg-slate-800/40",
        isSelected && "bg-sky-500/10 hover:bg-sky-500/15 border-l-2 border-l-sky-500",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  )
);
TableRow.displayName = "TableRow";

export const TableHead = forwardRef(({ className, children, ...props }, ref) => (
  <th
    ref={ref}
    className={cn("h-11 px-4 text-left align-middle font-semibold text-slate-400 select-none text-xs", className)}
    {...props}
  >
    {children}
  </th>
));
TableHead.displayName = "TableHead";

export const TableCell = forwardRef(({ className, children, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("py-3.5 px-4 align-middle text-slate-200 text-sm", className)}
    {...props}
  >
    {children}
  </td>
));
TableCell.displayName = "TableCell";

export const TableEmpty = ({
  icon: Icon = Inbox,
  title = "Nenhum registro encontrado",
  description = "Não há dados cadastrados para exibir no momento.",
  colSpan = 5,
  className
}) => (
  <tr>
    <td colSpan={colSpan} className={cn("p-12 text-center", className)}>
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-slate-200">{title}</h4>
          <p className="text-xs text-slate-400 max-w-sm">{description}</p>
        </div>
      </div>
    </td>
  </tr>
);

export default Table;
