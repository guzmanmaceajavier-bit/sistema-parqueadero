import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import Login from "../pages/Login";

const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const Clientes = lazy(() => import("../pages/Clientes"));
const PerfilCliente = lazy(() => import("../pages/PerfilCliente"));
const Vehiculos = lazy(() => import("../pages/Vehiculos"));
const Puestos = lazy(() => import("../pages/Puestos"));
const Ingresos = lazy(() => import("../pages/Ingresos"));
const Tarifas = lazy(() => import("../pages/Tarifas"));
const Caja = lazy(() => import("../pages/Caja"));
const Gastos = lazy(() => import("../pages/Gastos"));
const Mensualidades = lazy(() => import("../pages/Mensualidades"));
const Reservas = lazy(() => import("../pages/Reservas"));
const Ausencias = lazy(() => import("../pages/Ausencias"));
const Ocupacion = lazy(() => import("../pages/Ocupacion"));
const Reportes = lazy(() => import("../pages/Reportes"));
const Facturas = lazy(() => import("../pages/Facturas"));
const Movimientos = lazy(() => import("../pages/Movimientos"));
const Usuarios = lazy(() => import("../pages/Usuarios"));
const Planes = lazy(() => import("../pages/Planes"));
const Configuracion = lazy(() => import("../pages/Configuracion"));
const Sucursales = lazy(() => import("../pages/Sucursales"));
const BackupPage = lazy(() => import("../pages/BackupPage"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function GuestRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <Spinner />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function AppRouter() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<GuestRoute />} />
        <Route path="/forgot-password" element={<Suspense fallback={<Spinner />}><ForgotPassword /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<Spinner />}><ResetPassword /></Suspense>} />
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Suspense fallback={<Spinner />}><DashboardPage /></Suspense>} />
            <Route path="/clientes" element={<Suspense fallback={<Spinner />}><Clientes /></Suspense>} />
            <Route path="/clientes/:id/perfil" element={<Suspense fallback={<Spinner />}><PerfilCliente /></Suspense>} />
            <Route path="/vehiculos" element={<Suspense fallback={<Spinner />}><Vehiculos /></Suspense>} />
            <Route path="/puestos" element={<Suspense fallback={<Spinner />}><Puestos /></Suspense>} />
            <Route path="/ingresos" element={<Suspense fallback={<Spinner />}><Ingresos /></Suspense>} />
            <Route path="/tarifas" element={<Suspense fallback={<Spinner />}><Tarifas /></Suspense>} />
            <Route path="/planes" element={<Suspense fallback={<Spinner />}><Planes /></Suspense>} />
            <Route path="/caja" element={<Suspense fallback={<Spinner />}><Caja /></Suspense>} />
            <Route path="/gastos" element={<Suspense fallback={<Spinner />}><Gastos /></Suspense>} />
            <Route path="/mensualidades" element={<Suspense fallback={<Spinner />}><Mensualidades /></Suspense>} />
            <Route path="/reservas" element={<Suspense fallback={<Spinner />}><Reservas /></Suspense>} />
            <Route path="/ausencias" element={<Suspense fallback={<Spinner />}><Ausencias /></Suspense>} />
            <Route path="/ocupacion" element={<Suspense fallback={<Spinner />}><Ocupacion /></Suspense>} />
            <Route path="/reportes" element={<Suspense fallback={<Spinner />}><Reportes /></Suspense>} />
            <Route path="/facturas" element={<Suspense fallback={<Spinner />}><Facturas /></Suspense>} />
            <Route path="/movimientos" element={<Suspense fallback={<Spinner />}><Movimientos /></Suspense>} />
            <Route path="/configuracion" element={<Suspense fallback={<Spinner />}><Configuracion /></Suspense>} />

            <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
              <Route path="/usuarios" element={<Suspense fallback={<Spinner />}><Usuarios /></Suspense>} />
              <Route path="/sucursales" element={<Suspense fallback={<Spinner />}><Sucursales /></Suspense>} />
              <Route path="/backup" element={<Suspense fallback={<Spinner />}><BackupPage /></Suspense>} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;
