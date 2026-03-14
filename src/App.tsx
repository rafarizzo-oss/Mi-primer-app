/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ListTodo, Calendar as CalendarIcon, Clock, Bell, BellOff, X, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueDate?: string; // ISO string
  notified?: boolean;
  synced?: boolean;
}

interface User {
  name: string;
  email: string;
  picture: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // Persistence
  useEffect(() => {
    localStorage.setItem('minimal-todos', JSON.stringify(todos));
  }, [todos]);

  // Auth Check
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Auth request failed');
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      console.error("Auth check failed", e);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        console.log("Server Health:", data);
      } catch (e) {
        console.error("Server unreachable:", e);
      }
    };
    checkServer();
    checkAuth();
  }, []);

  // OAuth Success Listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        checkAuth();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = async () => {
    console.log("Iniciando login...");
    try {
      // Intento de obtener la URL con reintentos básicos
      let res;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          res = await fetch('/api/auth/google/url');
          if (res.ok) break;
        } catch (e) {
          console.warn(`Intento ${attempts + 1} fallido, reintentando...`);
        }
        attempts++;
        await new Promise(r => setTimeout(r, 1000));
      }

      if (!res || !res.ok) {
        throw new Error(`No se pudo contactar con el servidor tras ${maxAttempts} intentos.`);
      }

      console.log("Respuesta del servidor (status):", res.status);
      
      const contentType = res.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Respuesta no es JSON:", text.substring(0, 200));
        throw new Error(`El servidor respondió con HTML (Status: ${res.status}). Esto suele significar que la ruta no existe o el servidor está reiniciando. Por favor, espera 10 segundos y vuelve a intentarlo.`);
      }

      const data = await res.json();
      
      if (data.error) {
        console.error("Error del servidor:", data.error);
        throw new Error(data.error);
      }

      if (!data.url) {
        throw new Error("No se recibió la URL de autenticación");
      }

      console.log("Abriendo ventana de Google...");
      const popup = window.open(data.url, 'google_auth', 'width=500,height=600');
      
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        alert("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
      }
    } catch (e) {
      console.error("Fallo al obtener la URL de auth", e);
      const errorMessage = e instanceof Error ? e.message : "Error desconocido";
      alert(`Error de conexión con el servidor: ${errorMessage}. Por favor, verifica que la app esté corriendo y que no haya bloqueos de red.`);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

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

  // Alarm Logic
  const checkAlarms = useCallback(() => {
    const now = new Date();
    let updated = false;
    const newTodos = todos.map(todo => {
      if (!todo.completed && todo.dueDate && !todo.notified) {
        const due = new Date(todo.dueDate);
        if (due <= now) {
          updated = true;
          setActiveNotification(todo);
          if (Notification.permission === "granted") {
            new Notification("Recordatorio de Tarea", { body: todo.text });
          }
          return { ...todo, notified: true };
        }
      }
      return todo;
    });

    if (updated) setTodos(newTodos);
  }, [todos]);

  useEffect(() => {
    const interval = setInterval(checkAlarms, 10000);
    return () => clearInterval(interval);
  }, [checkAlarms]);

  const syncToGoogleCalendar = async (todo: Todo) => {
    if (!user || !todo.dueDate || todo.synced) return;
    
    setIsSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: todo.text, dueDate: todo.dueDate }),
      });
      if (res.ok) {
        setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, synced: true } : t));
      }
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputValue.trim(),
      completed: false,
      createdAt: Date.now(),
      dueDate: dueDate || undefined,
      notified: false,
      synced: false,
    };

    setTodos([newTodo, ...todos]);
    setInputValue('');
    setDueDate('');

    if (newTodo.dueDate && user) {
      await syncToGoogleCalendar(newTodo);
    }
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
            <button onClick={() => setActiveNotification(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-xl mx-auto px-6 py-20">
        {/* User Profile / Login */}
        <div className="flex justify-end mb-8">
          {isLoadingAuth ? (
            <div className="w-32 h-10 bg-gray-100 animate-pulse rounded-full" />
          ) : user ? (
            <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full shadow-sm border border-gray-100">
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Conectado</p>
                <p className="text-xs font-semibold">{user.name}</p>
              </div>
              <button onClick={handleLogout} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100 text-xs font-bold uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              <LogIn size={16} />
              Entrar con Google
            </button>
          )}
        </div>

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
              disabled={isSyncing}
              className="p-2 bg-black text-white rounded-xl hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 px-4 py-2 disabled:opacity-50"
            >
              {isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
              <span className="text-xs font-bold uppercase tracking-widest">{isSyncing ? 'Sincronizando...' : 'Añadir'}</span>
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
                filter === f ? 'bg-black text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group bg-white rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-all border border-gray-100"
              >
                <button onClick={() => toggleTodo(todo.id)} className={`mt-1 transition-colors ${todo.completed ? 'text-emerald-500' : 'text-gray-200 hover:text-gray-400'}`}>
                  {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>
                
                <div className="flex-1 min-w-0">
                  <p className={`text-lg leading-tight transition-all duration-300 ${todo.completed ? 'text-gray-300 line-through' : 'text-gray-700'}`}>
                    {todo.text}
                  </p>
                  
                  {todo.dueDate && (
                    <div className="flex items-center gap-3 mt-2">
                      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${new Date(todo.dueDate) < new Date() && !todo.completed ? 'text-red-400' : 'text-gray-400'}`}>
                        <Clock size={12} />
                        <span>{new Date(todo.dueDate).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {todo.synced && (
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">
                          <CalendarIcon size={10} />
                          Sincronizado
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={() => deleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <Trash2 size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
