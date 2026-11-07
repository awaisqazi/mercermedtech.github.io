/**
 * Choosing a task for an hours entry: a button showing the choice, opening a
 * short searchable list. Open tasks come first, finished ones after. Same
 * combobox behaviour as PersonPicker (type to filter, arrows, Enter, Escape),
 * kept here because the shared picker only knows people.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { IconChevronDown, IconSearch } from '../../components/Icons';
import { ProjectMark } from '../../components/ProjectMark';
import type { Project, Task } from '../../lib/types';

export interface TaskPickerProps {
  value: string | null;
  onChange: (task: Task | null) => void;
  tasks: readonly Task[];
  projects: ReadonlyMap<string, Project>;
  label: string;
  hint?: string;
  disabled?: boolean;
}

const NONE = '__none__';
const LIMIT = 60;

export function TaskPicker({ value, onChange, tasks, projects, label, hint, disabled = false }: TaskPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-list`;

  const chosen = value ? (tasks.find((task) => task.id === value) ?? null) : null;

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ordered = [...tasks].sort((a, b) => {
      const aDone = a.status === 'done' ? 1 : 0;
      const bDone = b.status === 'done' ? 1 : 0;
      return aDone - bDone || a.sort - b.sort || a.title.localeCompare(b.title);
    });
    const matched = ordered.filter((task) => {
      if (!needle) return true;
      const project = task.project_id ? projects.get(task.project_id) : undefined;
      return `${task.title} ${project?.code ?? ''} ${project?.name ?? ''}`.toLowerCase().includes(needle);
    });
    const rows: Array<{ key: string; task: Task | null }> = matched.slice(0, LIMIT).map((task) => ({ key: task.id, task }));
    if (!needle || 'no task'.includes(needle)) rows.unshift({ key: NONE, task: null });
    return rows;
  }, [tasks, projects, query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    window.setTimeout(() => search.current?.focus(), 0);
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setHighlight(0), [query]);

  const pick = (task: Task | null) => {
    setOpen(false);
    button.current?.focus();
    if ((task?.id ?? null) !== value) onChange(task);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Ours, not the dialog's underneath.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlight((current) => (current + step + options.length) % Math.max(1, options.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[highlight];
      if (option) pick(option.task);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const activeId = options[highlight] ? `${id}-${options[highlight]!.key}` : undefined;

  return (
    <div class="wb-picker hours-task-picker" ref={wrap}>
      <span class="wb-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        type="button"
        ref={button}
        class="wb-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span class="wb-picker-value" id={`${id}-value`}>
          {chosen ? chosen.title : 'No task'}
        </span>
        <IconChevronDown size={14} class="wb-picker-caret" />
      </button>
      {hint ? (
        <p class="wb-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {open ? (
        <div class="wb-picker-pop">
          <div class="wb-picker-search">
            <IconSearch size={15} />
            <input
              ref={search}
              class="wb-picker-input"
              type="text"
              role="combobox"
              aria-label="Search tasks"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              placeholder="Search tasks"
              value={query}
              onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <ul class="wb-picker-list" role="listbox" id={listId} aria-label={label}>
            {options.map((option, index) => {
              const selected = (option.task?.id ?? null) === value;
              const project = option.task?.project_id ? projects.get(option.task.project_id) : undefined;
              return (
                <li
                  key={option.key}
                  id={`${id}-${option.key}`}
                  role="option"
                  aria-selected={selected}
                  class={`wb-picker-option${index === highlight ? ' is-highlighted' : ''}${selected ? ' is-selected' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option.task)}
                >
                  <span class="wb-picker-option-text">
                    <span>{option.task ? option.task.title : 'No task'}</span>
                    {option.task && (project || option.task.status === 'done') ? (
                      <span class="wb-picker-option-sub hours-task-sub">
                        {project ? <ProjectMark project={project} /> : null}
                        {option.task.status === 'done' ? <span>Done</span> : null}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {options.length === 0 ? <li class="wb-picker-empty">No task matches that.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
