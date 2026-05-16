'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '../services/api';

type Local = { id: number; nome: string };
type Sala = { id: number; nome: string; local_id: number };

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [currentView, setCurrentView] = useState('login');
  const [reservas, setReservas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [locais, setLocais] = useState<Local[]>([
    { id: 1, nome: "Sede Principal" },
    { id: 2, nome: "Filial Paulista" }
  ]); 
  
  const [salasMaster, setSalasMaster] = useState<Sala[]>([
    { id: 1, nome: "Sala de Reuniões 01", local_id: 1 },
    { id: 2, nome: "Sala de Reuniões 02", local_id: 1 },
    { id: 3, nome: "Sala Loft 01", local_id: 2 }
  ]); 
  
  const [availableSalas, setAvailableSalas] = useState<Sala[]>([]); 
  const [authData, setAuthData] = useState({ email: '', password: '' });

  const [formData, setFormData] = useState({
    responsavel: '',
    descricao: '',
    data_inicio: '',
    data_fim: '',
    local_id: 1,
    sala_id: 1,
    cafe: false,
    quantidade_pessoas: 1
  });

  const refreshData = useCallback(async () => {
    if (currentView !== 'dashboard') return;
    try {
      const { data } = await api.get('/reservas');
      setReservas(data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('jwt_token');
        setCurrentView('login');
        alert("Sessão expirada. Faça login novamente.");
      }
    }
  }, [currentView]);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('jwt_token');
    
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setCurrentView('dashboard');
      
      Promise.all([
        api.get('/locais'),
        api.get('/salas')
      ]).then(([{ data: locaisData }, { data: salasData }]) => {
        if (locaisData && locaisData.length > 0) setLocais(locaisData);
        if (salasData && salasData.length > 0) setSalasMaster(salasData);
        refreshData();
      }).catch(() => {
        refreshData();
      });
    }
  }, [currentView, refreshData]);

  useEffect(() => {
    const filtered = salasMaster.filter(sala => sala.local_id === formData.local_id);
    setAvailableSalas(filtered);

    if (filtered.length > 0 && !filtered.some(s => s.id === formData.sala_id)) {
      setFormData(prev => ({ ...prev, sala_id: filtered[0].id }));
    }
  }, [formData.local_id, salasMaster, formData.sala_id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      
      if (!res.ok) {
        alert("Credenciais inválidas. Verifique o e-mail e a senha.");
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      localStorage.setItem('jwt_token', data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      
      setCurrentView('dashboard');
      setAuthData({ email: '', password: '' });
      
      try {
        const [locaisRes, salasRes, reservasRes] = await Promise.all([
          api.get('/locais'),
          api.get('/salas'),
          api.get('/reservas')
        ]);
        setLocais(locaisRes.data);
        setSalasMaster(salasRes.data);
        setReservas(reservasRes.data);
      } catch {
        refreshData();
      }
    } catch (err) {
      alert("Erro de comunicação: Certifique-se de que o servidor C# está ativo na porta 5000.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      
      if (!res.ok) {
        alert("Erro ao registrar. Verifique os requisitos de senha ou se o e-mail já existe.");
        return;
      }
      
      alert("Cadastro realizado com sucesso! Utilize suas credenciais para entrar.");
      setCurrentView('login');
      setAuthData({ email: '', password: '' });
    } catch (err) {
      alert("Erro de comunicação com o servidor C#.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    delete api.defaults.headers.common['Authorization'];
    setCurrentView('login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        responsavel: formData.responsavel,
        descricao: formData.descricao,
        data_inicio: new Date(formData.data_inicio).toISOString(),
        data_fim: new Date(formData.data_fim).toISOString(),
        sala_id: Number(formData.sala_id),
        cafe: Boolean(formData.cafe),
        quantidade_pessoas: formData.cafe ? Number(formData.quantidade_pessoas) : 0
      };

      if (editingId) {
        await api.put(`/reservas/${editingId}`, payload);
      } else {
        await api.post('/reservas', payload);
      }
      
      fecharModal();
      await refreshData();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert("CONFLITO: Já existe uma reunião agendada nesta sala para o horário escolhido.");
      } else {
        alert(err.response?.data?.detail || "Erro ao salvar a reserva no servidor Python.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      await api.delete(`/reservas/${id}`);
      await refreshData();
    } catch (err) {
      alert("Erro ao tentar excluir o registro.");
    }
  };

  const abrirModalEdicao = (reserva: any) => {
    const formatForInput = (iso: string) => new Date(iso).toISOString().slice(0, 16);
    setFormData({
      responsavel: reserva.responsavel, // Corrigido aqui
      descricao: reserva.descricao,
      data_inicio: formatForInput(reserva.data_inicio),
      data_fim: formatForInput(reserva.data_fim),
      local_id: reserva.local_id || 1,
      sala_id: reserva.sala_id,
      cafe: reserva.cafe,
      quantidade_pessoas: reserva.quantidade_pessoas || 1
    });
    setEditingId(reserva.id);
    setShowModal(true);
  };

  const fecharModal = () => {
    setFormData({ responsavel: '', descricao: '', data_inicio: '', data_fim: '', local_id: 1, sala_id: 1, cafe: false, quantidade_pessoas: 1 }); // Corrigido aqui
    setEditingId(null);
    setShowModal(false);
  };

  const formatarData = (iso: string) => {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  };

  if (!mounted) return null;

  if (currentView === 'login' || currentView === 'register') {
    const isLogin = currentView === 'login';
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6 font-sans">
        <form onSubmit={isLogin ? handleLogin : handleRegister} className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">SALACERTA</h1>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mt-1">
              {isLogin ? 'Agendamento Inteligente' : 'Novo Cadastro'}
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail Corporativo</label>
              <input required type="email" placeholder="admin@empresa.com" 
                className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-600 text-slate-800"
                value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Senha de Acesso</label>
              <input required type="password" placeholder="••••••••" 
                className="w-full p-4 border border-slate-200 rounded-xl outline-none focus:ring-2 ring-blue-600 text-slate-800"
                value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg mt-2 disabled:opacity-50">
              {loading ? 'Processando...' : (isLogin ? 'ACESSAR SISTEMA' : 'CRIAR CONTA')}
            </button>
          </div>
          <div className="mt-6 text-center border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-500">
              {isLogin ? 'Ainda não possui credenciais?' : 'Já possui uma conta?'}
            </p>
            <button type="button" onClick={() => { setCurrentView(isLogin ? 'register' : 'login'); setAuthData({email: '', password: ''}); }} className="text-blue-600 font-bold hover:underline mt-1">
              {isLogin ? 'Solicitar Acesso' : 'Voltar para Login'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <nav className="bg-[#0F172A] text-white p-6 shadow-xl border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-black tracking-tighter">SALACERTA <span className="font-light text-blue-400">ADMIN</span></h1>
          <div className="flex items-center gap-6">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block border-r border-slate-700 pr-6">Portal de Reservas</div>
            <button onClick={handleLogout} className="text-sm font-bold text-slate-300 hover:text-white transition-colors">SAIR</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Ocupação</h2>
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-black shadow-lg">
            AGENDAR REUNIÃO
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Responsável</th>
                <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Pauta da Reunião</th>
                <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Início do Evento</th>
                <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">Término do Evento</th>
                <th className="p-6 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservas.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-slate-400 italic">Nenhum registro ativo no sistema.</td></tr>
              ) : (
                reservas.map((res: any) => (
                  <tr key={res.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6 font-bold text-slate-800">{res.responsavel}</td>
                    <td className="p-6 text-slate-600">{res.descricao}</td>
                    <td className="p-6 text-sm font-bold text-blue-600">{formatarData(res.data_inicio)}</td>
                    <td className="p-6 text-sm font-bold text-slate-500">{formatarData(res.data_fim)}</td>
                    <td className="p-6 text-right space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => abrirModalEdicao(res)} className="text-xs font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider">Remarcar</button>
                      <button onClick={() => handleDelete(res.id)} className="text-xs font-bold text-red-400 hover:text-red-600 uppercase tracking-wider">Cancelar</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="bg-[#0F172A] p-6 text-white text-center">
                <h3 className="text-xl font-black uppercase">{editingId ? 'Remarcar Agendamento' : 'Novo Agendamento'}</h3>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Filial / Local</label>
                    <select required className="w-full p-4 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 bg-white"
                      value={formData.local_id} 
                      onChange={e => setFormData({...formData, local_id: Number(e.target.value)})}>
                      {locais.map(local => (
                        <option key={local.id} value={local.id}>{local.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Sala de Reunião</label>
                    <select required className="w-full p-4 border border-slate-200 rounded-xl outline-none font-bold text-slate-700 bg-white"
                      value={formData.sala_id} 
                      onChange={e => setFormData({...formData, sala_id: Number(e.target.value)})}>
                      {availableSalas.map(sala => (
                        <option key={sala.id} value={sala.id}>{sala.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Responsável</label>
                  <input required placeholder="Nome do organizador" className="w-full p-4 border border-slate-200 rounded-xl outline-none font-medium text-slate-800" 
                    value={formData.responsavel} onChange={e => setFormData({...formData, responsavel: e.target.value})} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Pauta</label>
                  <input required placeholder="Assunto da reunião" className="w-full p-4 border border-slate-200 rounded-xl outline-none font-medium text-slate-800" 
                    value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Início</label>
                    <input type="datetime-local" required className="w-full p-4 border border-slate-200 rounded-xl font-bold text-slate-700" 
                      value={formData.data_inicio} onChange={e => setFormData({...formData, data_inicio: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Término</label>
                    <input type="datetime-local" required className="w-full p-4 border border-slate-200 rounded-xl font-bold text-slate-700" 
                      value={formData.data_fim} onChange={e => setFormData({...formData, data_fim: e.target.value})} />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded border-slate-300" 
                      checked={formData.cafe} onChange={e => setFormData({...formData, cafe: e.target.checked})} />
                    <span className="text-sm font-bold text-slate-700">Incluir Serviço de Copa (Café/Água)</span>
                  </label>
                  {formData.cafe && (
                    <div className="mt-3 pl-8">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">Quantidade de Pessoas</label>
                      <input type="number" min="1" required={formData.cafe} className="w-full mt-1 p-3 border border-slate-200 rounded-xl outline-none font-medium text-slate-800" 
                        value={formData.quantidade_pessoas} onChange={e => setFormData({...formData, quantidade_pessoas: Number(e.target.value)})} />
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={fecharModal} className="flex-1 py-4 font-bold text-slate-400 uppercase tracking-widest text-sm hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-black shadow-lg disabled:opacity-50 hover:bg-blue-700 transition-all">
                    {loading ? 'PROCESSANDO...' : 'CONFIRMAR'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}