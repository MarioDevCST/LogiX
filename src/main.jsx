import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Inactive from "./pages/Inactive.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Users from "./pages/Users.jsx";
import UserDetail from "./pages/UserDetail.jsx";
import Ships from "./pages/Ships.jsx";
import ShipDetail from "./pages/ShipDetail.jsx";
import CompanyDetail from "./pages/CompanyDetail.jsx";
import LocationDetail from "./pages/LocationDetail.jsx";
import Loads from "./pages/Loads.jsx";
import LoadDetail from "./pages/LoadDetail.jsx";
import Pallets from "./pages/Pallets.jsx";
import PalletDetail from "./pages/PalletDetail.jsx";
import PalletLoading from "./pages/PalletLoading.jsx";
import "./index.css";
import ConsigneeDetail from "./pages/ConsigneeDetail.jsx";
import Messages from "./pages/Messages.jsx";
import MessageDetail from "./pages/MessageDetail.jsx";
import Collections from "./pages/Collections.jsx";
import Interactions from "./pages/Interactions.jsx";
import "./firebase/init.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inactive" element={<Inactive />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          {/* Administración */}
          <Route path="admin/usuarios" element={<Users />} />
          <Route path="admin/usuarios/:id" element={<UserDetail />} />
          <Route path="admin/interacciones" element={<Interactions />} />
          <Route path="admin/colecciones" element={<Collections />} />
          <Route
            path="admin/consignatarios"
            element={<Collections initialTab="consignees" />}
          />
          <Route
            path="admin/consignatarios/:id"
            element={<ConsigneeDetail />}
          />
          <Route path="admin/barcos" element={<Ships />} />
          <Route path="admin/barcos/:id" element={<ShipDetail />} />
          <Route
            path="admin/empresas"
            element={<Collections initialTab="companies" />}
          />
          <Route path="admin/empresas/:id" element={<CompanyDetail />} />
          <Route
            path="admin/localizaciones"
            element={<Collections initialTab="locations" />}
          />
          <Route path="admin/localizaciones/:id" element={<LocationDetail />} />
          <Route path="admin/mensajes" element={<Messages />} />
          <Route path="admin/mensajes/:id" element={<MessageDetail />} />
          {/* Logística */}
          <Route path="logistica/cargas" element={<Loads />} />
          <Route path="logistica/cargas/:id" element={<LoadDetail />} />
          <Route path="logistica/carga-palets" element={<PalletLoading />} />
          {/* Palets */}
          <Route path="palets" element={<Pallets />} />
          <Route path="palets/:id" element={<PalletDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
