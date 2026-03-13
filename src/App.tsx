/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Calendar as CalendarIcon, Clock, Bell, BellOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueDate?: string; // ISO string
  notified?: boolean;
}

type Filter = 'all' | 'active' | 'completed' | 'scheduled';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem('minimal-todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputValue, setInputValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Todo | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('minimal-todos', JSON.stringify(todos));
  }, [todos]);

  // Notification Permission
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    }
  };

  // Alarm Logic: Check every 10 seconds
  const checkAlarms = useCallback(() => {
    const now = new Date();
    let updated = false;
    const newTodos = todos.map(todo => {
      if (!todo.completed && todo.dueDate && !todo.notified) {
        const due = new Date(todo.dueDate);
        if (due <= now) {
          updated = true;
          // Trigger in-app notification
          setActiveNotification(todo);
          
          // Trigger browser notification if permitted
          if (Notification.permission === "granted") {
            new Notification("Recordatorio de Tarea", {
              body: todo.text,
              icon: "https://cdn-icons-png.flaticon.com/512/906/906334.png"
            });
          }
          return { ...todo, notified: true };
        }
      }
      return todo;
    });

    if (updated) {
      setTodos(newTodos);
    }
  }, [todos]);

  useEffect(() => {
    const interval = setInterval(checkAlarms, 10000);
    return () => clearInterval(interval);
  }, [checkAlarms]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputValue.trim(),
      completed: false,
      createdAt: Date.now(),
      dueDate: dueDate || undefined,
      notified: false,
    };

    setTodos([newTodo, ...todos]);
    setInputValue('');
    setDueDate('');
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
    if (filter === 'scheduled') return !!todo.dueDate && !todo.completed;
    return true;
  });

  const activeCount = todos.filter(t => !t.completed).length;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] font-sans selection:bg-black selection:text-white">
      {/* In-App Notification Overlay */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-black text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/10"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-full">
                <Bell className="text-yellow-400 animate-bounce" size={20} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">¡Alarma!</p>
                <p className="text-sm font-medium">{activeNotification.text}</p>
              </div>
            </div>
            <button 
              onClick={() => setActiveNotification(null)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-xl mx-auto px-6 py-20">
        {/* Header */}
        <header className="mb-12 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted mb-2">
              <CalendarIcon size={14} className="text-gray-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>
            <h1 className="text-4xl font-light tracking-tight flex items-center gap-3">
              <ListTodo className="text-black" size={32} />
              Mis Tareas
            </h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button 
              onClick={requestNotificationPermission}
              className={`p-2 rounded-full transition-all ${notificationsEnabled ? 'text-emerald-500 bg-emerald-50' : 'text-gray-300 hover:text-gray-400 bg-gray-100'}`}
              title={notificationsEnabled ? "Notificaciones activadas" : "Activar notificaciones"}
            >
              {notificationsEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <div className="text-right">
              <span className="text-3xl font-light">{activeCount}</span>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Pendientes</p>
            </div>
          </div>
        </header>

        {/* Input Form */}
        <form onSubmit={addTodo} className="bg-white rounded-3xl p-2 shadow-sm mb-8 border border-gray-100">
          <div className="flex items-center px-4 py-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-gray-300 py-2"
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-50">
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={16} />
              <input 
                type="datetime-local" 
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs font-medium bg-transparent border-none outline-none cursor-pointer hover:text-black transition-colors"
              />
            </div>
            <button
              type="submit"
              className="p-2 bg-black text-white rounded-xl hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 px-4 py-2"
            >
              <Plus size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Añadir</span>
            </button>
          </div>
        </form>

        {/* Filters */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {(['all', 'active', 'completed', 'scheduled'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all ${
                filter === f 
                  ? 'bg-black text-white shadow-lg shadow-black/10' 
                  : 'bg-white text-gray-400 hover:text-gray-600 border border-gray-100'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'active' ? 'Activas' : f === 'completed' ? 'Hechas' : 'Programadas'}
            </button>
          ))}
        </div>

        {/* Todo List */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredTodos.map((todo) => (
              <motion.div
                key={todo.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className="group bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all border border-gray-100"
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`mt-1 transition-colors ${todo.completed ? 'text-emerald-500' : 'text-gray-200 hover:text-gray-400'}`}
                >
                  {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-lg leading-tight transition-all duration-300 ${
                    todo.completed ? 'text-gray-300 line-through' : 'text-gray-700'
                  }`}>
                    {todo.text}
                  </p>
                  
                  {todo.dueDate && (
                    <div className={`flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-widest ${
                      new Date(todo.dueDate) < new Date() && !todo.completed ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      <Clock size={12} />
                      <span>
                        {new Date(todo.dueDate).toLocaleString('es-ES', { 
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                        })}
                      </span>
                      {todo.notified && !todo.completed && (
                        <span className="ml-2 bg-red-50 text-red-500 px-1.5 py-0.5 rounded">¡Vencida!</span>
                      )}
                    </div>
                  )}
                </div>

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
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ListTodo className="text-gray-300" size={24} />
              </div>
              <p className="text-gray-400 font-medium">No hay tareas en esta sección</p>
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
