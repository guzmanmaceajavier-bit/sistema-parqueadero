import { useEffect, useState, useCallback } from "react";
import { Users } from "lucide-react";
import FormModal from "../components/ui/FormModal";
import api from "../services/api";
import Toast from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import ExportButton from "../components/ExportButton";
import SelectWithOther from "../components/SelectWithOther";
import { TableSkeleton } from "../components/Skeleton";

const inputClass = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all duration-200 bg-white dark:bg-slate-700";
const labelClass = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5";

function IconUser() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IconX() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function IconKey() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function RolBadge({ rol }) {
  const colors = { admin: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800", supervisor: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", empleado: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" };
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${colors[rol] || colors.empleado}`}>{rol}</span>;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [editarId, setEditarId] = useState(null);
  const [cambiarPass, setCambiarPass] = useState(false);
  const [toast, setToast] = useState({ mensaje: "", tipo: "" });
  const [confirm, setConfirm] = useState({ abierto: false, titulo: "", mensaje: "", onConfirm: () => {} });
  const mostrarToast = useCallback((mensaje, tipo = "success") => setToast({ mensaje, tipo }), []);

  const formVacio = { nombre: "", usuario: "", correo: "", password: "", rol: "empleado" };
  const [form, setForm] = useState(formVacio);

  const cargarUsuarios = async () => {
    try { const res = await api.get("/usuarios"); setUsuarios(res.data.usuarios || []); } catch { console.log("error"); }
    finally { setInitialLoading(false); }
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const abrirNuevo = () => {
    setEditarId(null); setCambiarPass(false); setForm(formVacio); setMostrarModal(true);
  };

  const abrirEditar = (u) => {
    setEditarId(u.id); setCambiarPass(false);
    setForm({ nombre: u.nombre, usuario: u.usuario, correo: u.correo, password: "", rol: u.rol });
    setMostrarModal(true);
  };

  const abrirCambiarPass = (u) => {
    setEditarId(u.id); setCambiarPass(true);
    setForm({ nombre: u.nombre, usuario: u.usuario, correo: u.correo, password: "", rol: u.rol });
    setMostrarModal(true);
  };

  const guardarUsuario = async () => {
    setCargando(true);
    try {
      const payload = { ...form };
      if (payload.password) payload.password = payload.password;
      else delete payload.password;

      if (editarId) {
        if (cambiarPass) {
          await api.put(`/usuarios/${editarId}`, { password: form.password });
        } else {
          await api.put(`/usuarios/${editarId}`, payload);
        }
      } else {
        await api.post("/usuarios", payload);
      }
      setMostrarModal(false);
      cargarUsuarios();
      mostrarToast(editarId ? "Usuario actualizado" : "Usuario creado", "success");
    } catch (error) {
      mostrarToast(error.response?.data?.message || "Error al guardar usuario", "error");
    } finally { setCargando(false); }
  };

  const toggleEstado = async (u) => {
    try {
      await api.put(`/usuarios/estado/${u.id}`, { estado: !u.estado });
      cargarUsuarios();
      mostrarToast(u.estado ? "Usuario desactivado" : "Usuario activado", "success");
    } catch (error) { mostrarToast(error.response?.data?.message || "Error al cambiar estado", "error"); }
  };

  const eliminarUsuario = async (id) => {
    try { await api.delete(`/usuarios/${id}`); cargarUsuarios(); mostrarToast("Usuario eliminado", "success"); } catch (error) { mostrarToast("Error al eliminar usuario", "error"); }
  };

  const confirmarEliminar = (id) => {
    setConfirm({ abierto: true, titulo: "Eliminar usuario", mensaje: "¿Eliminar este usuario permanentemente?", onConfirm: () => eliminarUsuario(id) });
  };

  return (
    <div className="min-h-screen bg-page dark:bg-slate-900 p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Usuarios</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Administración de usuarios del sistema</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={usuarios.map(u => ({ Nombre: u.nombre || "", Usuario: u.usuario || "", Correo: u.correo || "", Rol: (u.rol || "").charAt(0).toUpperCase() + (u.rol || "").slice(1), Estado: u.estado ? "Activo" : "Inactivo", UltimoAcceso: u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString("es-CO") : "—" }))} filename="usuarios" title="Usuarios" columns={[{ key: 'Nombre', label: 'Nombre' }, { key: 'Usuario', label: 'Usuario' }, { key: 'Correo', label: 'Correo' }, { key: 'Rol', label: 'Rol' }, { key: 'Estado', label: 'Estado' }, { key: 'UltimoAcceso', label: 'Último Acceso' }]} />
          <button onClick={abrirNuevo} className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg font-medium text-sm shadow-lg shadow-teal-600/20">
            <IconPlus /> Nuevo Usuario
          </button>
        </div>
      </div>

      {initialLoading ? <TableSkeleton rows={8} cols={7} /> : (
      <div className="rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800 dark:bg-slate-700">
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Nombre</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Usuario</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Correo</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Rol</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Estado</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Último Acceso</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-300 dark:text-slate-300 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {usuarios.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center"><p className="text-slate-400 dark:text-slate-500 text-sm">No hay usuarios</p></td></tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-800 dark:text-white">{u.nombre}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{u.usuario}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-slate-300">{u.correo}</td>
                    <td className="px-4 py-3.5 text-center"><RolBadge rol={u.rol} /></td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${u.estado ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.estado ? "bg-emerald-500" : "bg-red-500"}`} />
                        {u.estado ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center text-sm text-slate-500 dark:text-slate-400">{u.ultimoAcceso ? new Date(u.ultimoAcceso).toLocaleString() : "Nunca"}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirEditar(u)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 border border-teal-200 dark:border-teal-800 rounded-lg">
                          <IconEdit /> Editar
                        </button>
                        <button onClick={() => abrirCambiarPass(u)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <IconKey /> Pass
                        </button>
                        <button onClick={() => toggleEstado(u)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${u.estado ? "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border-red-200 dark:border-red-800" : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800"}`}>
                          <IconShield /> {u.estado ? "Inactivar" : "Activar"}
                        </button>
                        <button onClick={() => confirmarEliminar(u.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg">
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <FormModal
        open={mostrarModal}
        onClose={() => setMostrarModal(false)}
        gradient="from-sky-600 to-teal-500"
        icon={Users}
        titulo={editarId ? (cambiarPass ? "Cambiar Contraseña" : "Editar Usuario") : "Nuevo Usuario"}
        footer={
          <>
            <button onClick={() => setMostrarModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">Cancelar</button>
            <button onClick={guardarUsuario} disabled={cargando} className="px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {cargando ? "Guardando..." : editarId ? (cambiarPass ? "Cambiar Contraseña" : "Guardar Cambios") : "Crear Usuario"}
            </button>
          </>
        }
      >
        <div className="bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 p-4 space-y-4">
          {!cambiarPass && (
            <>
              <div>
                <label className={labelClass}>Nombre</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} className={inputClass} disabled={!!editarId} />
              </div>
              <div>
                <label className={labelClass}>Usuario</label>
                <input name="usuario" value={form.usuario} onChange={handleChange} className={inputClass} disabled={!!editarId} />
              </div>
              <div>
                <label className={labelClass}>Correo</label>
                <input name="correo" type="email" value={form.correo} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <SelectWithOther
                  label="Rol"
                  name="rol"
                  value={form.rol}
                  onChange={handleChange}
                  options={[
                    { value: "empleado", label: "Empleado" },
                    { value: "supervisor", label: "Supervisor" },
                    { value: "admin", label: "Administrador" },
                  ]}
                  otherLabel="Otro rol"
                />
              </div>
            </>
          )}
          <div>
            <label className={labelClass}>{cambiarPass ? "Nueva Contraseña" : "Contraseña"}</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} className={inputClass} placeholder={editarId && !cambiarPass ? "Dejar vacío para no cambiar" : ""} />
          </div>
        </div>
      </FormModal>

      <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={() => setToast({ mensaje: "", tipo: "" })} />
      <ConfirmDialog abierto={confirm.abierto} titulo={confirm.titulo} mensaje={confirm.mensaje} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(c => ({ ...c, abierto: false }))} />
    </div>
  );
}
