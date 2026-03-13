/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

type Filter = 'all' | 'active' | 'completed';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('minimal-todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputValue, setInputValue] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    localStorage.setItem('minimal-todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputValue.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    setTodos([newTodo, ...todos]);
    setInputValue('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(t => !t.completed).length;

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-black selection:text-white">
      <div className="max-w-xl mx-auto px-6 py-20">
        {/* Header */}
        <header className="mb-12 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted mb-2">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <h1 className="text-4xl font-light tracking-tight flex items-center gap-3">
              <ListTodo className="text-black" size={32} />
              Mis Tareas
            </h1>
          </div>
          <div className="text-right">
            <span className="text-3xl font-light">{activeCount}</span>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Pendientes</p>
          </div>
        </header>

        {/* Input Form */}
        <form onSubmit={addTodo} className="relative mb-8 group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="¿Qué hay que hacer?"
            className="w-full bg-white border-none rounded-2xl px-6 py-4 shadow-sm focus:ring-2 focus:ring-black/5 transition-all outline-none text-lg placeholder:text-gray-300"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-xl hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus size={20} />
          </button>
        </form>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'active', 'completed'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f 
                  ? 'bg-black text-white shadow-md' 
                  : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : 'Completadas'}
            </button>
          ))}
        </div>

        {/* Todo List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filteredTodos.map((todo) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className="group bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`transition-colors ${todo.completed ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-400'}`}
                >
                  {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>
                
                <span className={`flex-1 text-lg transition-all duration-300 ${
                  todo.completed ? 'text-gray-300 line-through' : 'text-gray-700'
                }`}>
                  {todo.text}
                </span>

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredTodos.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <p className="text-gray-400 font-light italic">No hay tareas que mostrar</p>
            </motion.div>
          )}
        </div>

        {/* Footer info */}
        <footer className="mt-20 pt-8 border-t border-gray-200 flex justify-between items-center text-[10px] uppercase tracking-widest text-gray-400 font-bold">
          <span>Minimalist Todo App</span>
          <span>{todos.length} tareas en total</span>
        </footer>
      </div>
    </div>
  );
}
