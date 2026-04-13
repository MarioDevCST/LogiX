import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Inactive from "./pages/Inactive.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Users from "./pages/Users.jsx";
import UserDetail from "./pages/UserDetail.jsx";
import ShipDetail from "./pages/ShipDetail.jsx";
import CompanyDetail from "./pages/CompanyDetail.jsx";
import LocationDetail from "./pages/LocationDetail.jsx";
import Loads from "./pages/Loads.jsx";
import LoadDetail from "./pages/LoadDetail.jsx";
import Documentation from "./pages/Documentation.jsx";
import Pallets from "./pages/Pallets.jsx";
import PalletDetail from "./pages/PalletDetail.jsx";
import PalletLoading from "./pages/PalletLoading.jsx";
import "./index.css";
import ConsigneeDetail from "./pages/ConsigneeDetail.jsx";
import Messages from "./pages/Messages.jsx";
import MessageDetail from "./pages/MessageDetail.jsx";
import Collections from "./pages/Collections.jsx";
import Interactions from "./pages/Interactions.jsx";
import MyProfile from "./pages/MyProfile.jsx";
import Products from "./pages/Products.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import MermaDetail from "./pages/MermaDetail.jsx";
import Waste from "./pages/Waste.jsx";
import "./firebase/init.js";
import { ROLES, getCurrentRole } from "./utils/roles.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inactive" element={<Inactive />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="mi-perfil" element={<MyProfile />} />
          {/* Administración */}
          <Route
            path="admin/usuarios"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Users />
              )
            }
          />
          <Route
            path="admin/usuarios/:id"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <UserDetail />
              )
            }
          />
          <Route
            path="admin/interacciones"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Interactions />
              )
            }
          />
          <Route
            path="admin/colecciones"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Collections />
              )
            }
          />
          <Route
            path="admin/consignatarios"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Collections initialTab="consignees" />
              )
            }
          />
          <Route
            path="admin/consignatarios/:id"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <ConsigneeDetail />
              )
            }
          />
          <Route
            path="admin/barcos"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Collections initialTab="ships" />
              )
            }
          />
          <Route
            path="admin/barcos/:id"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <ShipDetail />
              )
            }
          />
          <Route
            path="admin/empresas"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Collections initialTab="companies" />
              )
            }
          />
          <Route
            path="admin/empresas/:id"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <CompanyDetail />
              )
            }
          />
          <Route
            path="admin/localizaciones"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <Collections initialTab="locations" />
              )
            }
          />
          <Route
            path="admin/localizaciones/:id"
            element={
              getCurrentRole() === ROLES.ALMACEN ? (
                <Navigate to="/app" replace />
              ) : (
                <LocationDetail />
              )
            }
          />
          <Route
            path="admin/mensajes"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <Messages />
              )
            }
          />
          <Route
            path="admin/mensajes/:id"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <MessageDetail />
              )
            }
          />
          {/* Logística */}
          <Route
            path="logistica/cargas"
            element={
              getCurrentRole() === ROLES.ALMACEN ||
              getCurrentRole() === ROLES.MOZO ? (
                <Navigate to="/app/palets" replace />
              ) : (
                <Loads />
              )
            }
          />
          <Route
            path="logistica/cargas/:id"
            element={
              getCurrentRole() === ROLES.ALMACEN ||
              getCurrentRole() === ROLES.MOZO ? (
                <Navigate to="/app/palets" replace />
              ) : (
                <LoadDetail />
              )
            }
          />
          <Route
            path="logistica/carga-palets"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ||
              getCurrentRole() === ROLES.MOZO ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <PalletLoading />
              )
            }
          />
          <Route path="logistica/documentacion" element={<Documentation />} />
          {/* Palets */}
          <Route
            path="palets"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <Pallets />
              )
            }
          />
          <Route
            path="palets/:id"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <PalletDetail />
              )
            }
          />
          {/* Productos */}
          <Route
            path="productos"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <Products />
              )
            }
          />
          <Route
            path="productos/:id"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <ProductDetail />
              )
            }
          />
          <Route
            path="mermas"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <Waste />
              )
            }
          />
          <Route
            path="mermas/:id"
            element={
              getCurrentRole() === ROLES.CONDUCTOR ? (
                <Navigate to="/app/logistica/cargas" replace />
              ) : (
                <MermaDetail />
              )
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
