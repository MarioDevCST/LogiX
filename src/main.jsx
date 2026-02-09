import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import AppLayout from './layout/AppLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Users from './pages/Users.jsx'
import UserDetail from './pages/UserDetail.jsx'
import Ships from './pages/Ships.jsx'
import ShipDetail from './pages/ShipDetail.jsx'
import Companies from './pages/Companies.jsx'
import CompanyDetail from './pages/CompanyDetail.jsx'
import Locations from './pages/Locations.jsx'
import LocationDetail from './pages/LocationDetail.jsx'
import Loads from './pages/Loads.jsx'
import LoadDetail from './pages/LoadDetail.jsx'
import Pallets from './pages/Pallets.jsx'
import PalletDetail from './pages/PalletDetail.jsx'
import './index.css'
import Consignees from './pages/Consignees.jsx'
import ConsigneeDetail from './pages/ConsigneeDetail.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppLayout />}> 
          <Route index element={<Dashboard />} />
          {/* Administración */}
          <Route path="admin/usuarios" element={<Users />} />
          <Route path="admin/usuarios/:id" element={<UserDetail />} />
          <Route path="admin/consignatarios" element={<Consignees />} />
          <Route path="admin/consignatarios/:id" element={<ConsigneeDetail />} />
          <Route path="admin/barcos" element={<Ships />} />
          <Route path="admin/barcos/:id" element={<ShipDetail />} />
          <Route path="admin/empresas" element={<Companies />} />
          <Route path="admin/empresas/:id" element={<CompanyDetail />} />
          <Route path="admin/localizaciones" element={<Locations />} />
          <Route path="admin/localizaciones/:id" element={<LocationDetail />} />
          {/* Logística */}
          <Route path="logistica/cargas" element={<Loads />} />
          <Route path="logistica/cargas/:id" element={<LoadDetail />} />
          {/* Palets */}
          <Route path="palets" element={<Pallets />} />
          <Route path="palets/:id" element={<PalletDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
