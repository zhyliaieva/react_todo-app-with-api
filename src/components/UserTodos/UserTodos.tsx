/* eslint-disable prettier/prettier */
import { Todo } from '../../types/Todo';
import React, { useEffect, useState, useRef } from 'react';
import { TodosList } from '../../components/TodoList/TodoList';
import { getTodos } from '../../api/todos';
import { createTodo } from '../../api/todos';

import { deleteTodo } from '../../api/todos';
import { updateTodo } from '../../api/todos';
import { TodoFooter } from '../TodoFooter/TodoFooter';
import { Loader } from '../Loader/Loader';
import { FilterType } from '../../types/FilterType';
import { TodoItem } from '../TodoItem/TodoItem';

type UserTodosProp = {
  userId: number;
};

export const UserTodos: React.FC<UserTodosProp> = ({
  userId,
}: {
  userId: number;
}) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [isErrorVisible, setIsErrorVisible] = useState(false);
  const [filter, setFilter] = useState<FilterType>(FilterType.All);
  const activeTodo = todos.filter(t => !t.completed).length;

  const inputTodoTitleFieldRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [isInputDisabled, setIsInputDisabled] = useState(false);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [processingIds, setProcessingIds] = useState<number[]>([]);

  const [todosToUpdate, setTodosToUpdate] = useState<Todo[]>([]);

  function visibleTodos() {
    switch (filter) {
      case FilterType.Active:
        return todos.filter(todo => !todo.completed);
      case FilterType.Completed:
        return todos.filter(todo => todo.completed);
      case FilterType.All:
      default:
        return todos;
    }
  }

  function loadTodos() {
    setLoading(true);
    setErrorMessage('');
    setIsErrorVisible(false);
    getTodos(userId)
      .then(setTodos)
      .catch(() => {
        setErrorMessage('Unable to load todos');
        setIsErrorVisible(true);
        setTimeout(() => setIsErrorVisible(false), 3000);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadTodos, [userId]);

  useEffect(() => {
    if (inputTodoTitleFieldRef) {
      inputTodoTitleFieldRef.current?.focus();
    }
  });

  useEffect(() => {
    if (todosToUpdate.length === 1) {
      inputTodoTitleFieldRef.current?.focus();
    }
  }, [todosToUpdate]);

  function addTodo(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setErrorMessage('');

    const trimmed = title.trim();

    if (!trimmed) {
      setErrorMessage('Title should not be empty');
      setIsErrorVisible(true);
      setTimeout(() => setIsErrorVisible(false), 3000);

      return;
    }

    if (isInputDisabled === true) {
      return;
    }

    setIsInputDisabled(true);

    const newTempTodo: Todo = {
      id: 0,
      userId,
      title: trimmed,
      completed: false,
    };

    setTempTodo(newTempTodo);

    createTodo({ title: trimmed, userId, completed: false })
      .then(newTodo => {
        setTodos(prev => [...prev, newTodo]);
        setTitle('');
      })
      .catch(() => {
        setErrorMessage('Unable to add a todo');
        setIsErrorVisible(true);
        setTimeout(() => setIsErrorVisible(false), 3000);
      })
      .finally(() => {
        setIsInputDisabled(false);
        setTempTodo(null);
      });
  }

  async function deleteUserTodo(todoId: number) {
    if (processingIds.includes(todoId)) {
      return Promise.resolve();
    }

    setProcessingIds(p => [...p, todoId]);

    return deleteTodo(todoId)
      .then(() => {
        setTodos(p_1 => p_1.filter(t => t.id !== todoId));
      })
      .catch(() => {
        setErrorMessage('Unable to delete a todo');
        setIsErrorVisible(true);
      })
      .finally(() => {
        setProcessingIds(p_2 => p_2.filter(id_1 => id_1 !== todoId));
      });
  }

  async function onClearCompleted() {
    const completed = todos.filter(t => t.completed);
    const ids = completed.map(t => t.id);

    setProcessingIds(prev => [...prev, ...ids]);

    const promises = ids.map(id => deleteTodo(id));
    const results = await Promise.allSettled(promises);
    const succeededIds = results
      .map((r, i) => (r.status === 'fulfilled' ? ids[i] : null))
      .filter(Boolean);

    setTodos(prev => prev.filter(t => !succeededIds.includes(t.id)));

    const rejectedIds = results
      .map((r, i) => (r.status === 'rejected' ? ids[i] : null))
      .filter(Boolean);

    if (rejectedIds.length > 0) {
      setErrorMessage('Unable to delete a todo');
      setIsErrorVisible(true);
    }

    setSelectedTodo(null);
  }

  async function updateUserTodo(todoToUpdate: Todo) {
    try {
      setProcessingIds(p => [...p, todoToUpdate.id]);
      const updated = await updateTodo(todoToUpdate);

      setTodos(current =>
        current.map(todo => (todo.id === updated.id ? updated : todo)),
      );

      return updated;
    } catch (error) {
      setErrorMessage('Unable to update a todo');
      setIsErrorVisible(true);
      setTimeout(() => setIsErrorVisible(false), 3000);

      throw error;
    } finally {
      setProcessingIds(p => p.filter(id => id !== todoToUpdate.id));
    }
  }

  async function handleToggleAll() {
    const allCompleted = todos.length > 0 && todos.every(t => t.completed);
    const newStatus = !allCompleted;

    const todosToEdit = todos.filter(t => t.completed !== newStatus);
    const idsToUpdate = todosToEdit.map(t => t.id);

    if (idsToUpdate.length === 0) {
      return;
    }

    setProcessingIds(prev => [...prev, ...idsToUpdate]);

    const promises = todosToEdit.map(todo =>
      updateUserTodo({ ...todo, completed: newStatus }),
    );

    const results = await Promise.allSettled(promises);

    const succeededIds = results
      .map((r, i) => (r.status === 'fulfilled' ? idsToUpdate[i] : null))
      .filter(Boolean);

    setTodos(prev =>
      prev.map(t =>
        succeededIds.includes(t.id) ? { ...t, completed: newStatus } : t,
      ),
    );

    const rejectedIds = results
      .map((r, i) => (r.status === 'rejected' ? idsToUpdate[i] : null))
      .filter(Boolean);

    if (rejectedIds.length > 0) {
      setErrorMessage('Unable to update a todo');
      setIsErrorVisible(true);
      setTimeout(() => setIsErrorVisible(false), 3000);
    }

    setSelectedTodo(null);
    setProcessingIds(prev => prev.filter(id => !idsToUpdate.includes(id)));
  }

  function onChangeEditTitle(id: number, newTitle: string) {
    setTodosToUpdate(prev =>
      prev.map(t => (t.id === id ? { ...t, title: newTitle } : t)),
    );
  }

  function onSaveEditTitle(id: number, newTitle: string): void | Promise<Todo> {
    const todoToUpdate = todosToUpdate.find(t => t.id === id);
    const trimmed = newTitle.trim();

    if (!todoToUpdate) {
      return;
    }

    if (trimmed === '') {
      return deleteUserTodo(id);
    }

    if (trimmed === todoToUpdate.title) {
      setTodosToUpdate(prev => prev.filter(t => t.id !== id));
    }

    return updateUserTodo({ ...todoToUpdate, title: trimmed })
      .then(updated => {
        setTodos(prev => prev.map(t => (t.id === id ? updated : t)));
        setTodosToUpdate(prev => prev.filter(t => t.id !== id));

        return updated;
      })
      .catch(() => {
        setErrorMessage('Unable to update a todo');
        setIsErrorVisible(true);
        setTimeout(() => setIsErrorVisible(false), 3000);

        setTodosToUpdate(prev => [...prev, todoToUpdate]);
      });
  }

  return (
    <>
      <div className="todoapp__content">
        <header className="todoapp__header">
          {/* this button should have `active` class only if all todos are completed */}
          {todos.length > 0 && (
            <button
              data-cy="ToggleAllButton"
              type="button"
              className={
                todos.every(t => t.completed)
                  ? 'todoapp__toggle-all active'
                  : 'todoapp__toggle-all'
              }
              onClick={handleToggleAll}
            ></button>
          )}

          {/* Add a todo on form submit */}
          <form onSubmit={addTodo}>
            <input
              ref={inputTodoTitleFieldRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={isInputDisabled}
              name="title"
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
            />
          </form>
        </header>

        {loading && <Loader />}
        {todos.length > 0 && (
          <TodosList
            todos={visibleTodos()}
            selectedTodoId={selectedTodo?.id}
            processingIds={processingIds}
            onDelete={deleteUserTodo}
            onUpdateUserTodo={updateUserTodo}
            inputTodoTitleFieldRef={inputTodoTitleFieldRef}
            editingTodos={todosToUpdate}
            onBeginEditTitle={todo => {
              if (todosToUpdate.find(t => t.id === todo.id)) {
                return;
              }

              setTodosToUpdate(prev => [...prev, { ...todo }]);
            }}
            onChangeEditTitle={onChangeEditTitle}
            onSaveEditTitle={onSaveEditTitle}
            onCancelEditTitle={() => {
              setTodosToUpdate([]);
            }}
          />
        )}
        {tempTodo && (
          <TodoItem
            todo={tempTodo}
            selectedTodoId={selectedTodo?.id}
            isProcessed={true}
            onDelete={() => deleteUserTodo?.(tempTodo.id)}
            onUpdateUserTodo={updateUserTodo}
            inputTodoTitleFieldRef={inputTodoTitleFieldRef}
            editingTodoId={todosToUpdate.find(t => t.id === tempTodo.id)?.id}
            editTitle={
              todosToUpdate.find(t => t.id === tempTodo.id)?.title ?? ''
            }
            onBeginEditTitle={todo => {
              if (todosToUpdate.find(t => t.id === todo.id)) {
                return;
              }

              setTodosToUpdate(prev => [...prev, { ...todo }]);
            }}
            onChangeEditTitle={onChangeEditTitle}
            onSaveEditTitle={onSaveEditTitle}
            onCancelEditTitle={() => {
              setTodosToUpdate([]);
            }}
          />
        )}
        {todos.length > 0 && (
          <TodoFooter
            todosCountActive={activeTodo}
            filter={filter}
            onChangeFilter={setFilter}
            canClearCompleted={todos.some(t => t.completed)}
            onClearCompleted={onClearCompleted}
          />
        )}
      </div>

      {/* DON'T use conditional rendering to hide the notification */}
      {/* Add the 'hidden' class to hide the message smoothly */}
      <div
        className={
          isErrorVisible
            ? 'notification is-danger is-light has-text-weight-normal'
            : 'notification is-danger is-light has-text-weight-normal hidden'
        }
        data-cy="ErrorNotification"
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setIsErrorVisible(false)}
        />
        {errorMessage}
        <br />
      </div>
    </>
  );
};
