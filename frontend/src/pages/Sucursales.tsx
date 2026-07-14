import { useState, useEffect } from "react";
import { Building2, Plus, Pencil, X } from "lucide-react";
import api from "../services/api";
import FormModal from "../components/ui/FormModal";

export default function Sucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", direccion: "", telefono: "" });

  const cargar = async () => {
    try {
      const res = await api.get("/sucursales");
      setSucursales(res.data.sucursales || res.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      if (editando) {
        await api.put(`/sucursales/${editando.id}`, form);
      } else {
        await api.post("/sucursales", form);
      }
      setShowModal(false);
      setEditando(null);
      setForm({ nombre: "", direccion: "", telefono: "" });
      cargar();
    } catch {}
  };

  if (loading) return <div className="p-8 text-center text-slate-400 dark:text-slate-500">Cargando...</div>;

  return (
    <div className="p-6 dark:bg-slate-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Building2 size={24} /> Sucursales
        </h1>
        <button onClick={() => { setEditando(null); setForm({ nombre: "", direccion: "", telefono: "" }); setShowModal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
          <Plus size={16} /> Nueva Sucursal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sucursales.map((s) => (
          <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">{s.nombre}</h3>
                {s.direccion && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{s.direccion}</p>}
                {s.telefono && <p className="text-sm text-slate-500 dark:text-slate-400">{s.telefono}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estado ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"}`}>
                {s.estado ? "Activo" : "Inactivo"}
              </span>
            </div>
            <button onClick={() => { setEditando(s); setForm({ nombre: s.nombre, direccion: s.direccion || "", telefono: s.telefono || "" }); setShowModal(true); }}
              className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1">
              <Pencil size={12} /> Editar
            </button>
          </div>
        ))}
      </div>

      <FormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        gradient="from-emerald-600 to-teal-500"
        icon={Building2}
        titulo={editando ? "Editar Sucursal" : "Nueva Sucursal"}
        subtitulo="Administra las sucursales del parqueadero"
        footer={
          <>
            <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 active:scale-[0.98] transition-all">Cancelar</button>
            <button type="submit" form="sucursal-form" className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] transition-all">{editando ? "Guardar" : "Crear"}</button>
          </>
        }
      >
        <form id="sucursal-form" onSubmit={guardar} className="space-y-4">
          <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Nombre</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Direccion</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white dark:bg-slate-700" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">Telefono</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white dark:bg-slate-700" />
            </div>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
