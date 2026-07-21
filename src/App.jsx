import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Stock from './pages/Stock'
import StockMovement from './pages/StockMovement'
import Transfer from './pages/Transfer'
import History from './pages/History'
import MasterPosm from './pages/MasterPosm'
import MasterGudang from './pages/MasterGudang'
import UserManagement from './pages/UserManagement'
import ScanKeluar from './pages/ScanKeluar'
import BarcodePrint from './pages/BarcodePrint'

function withLayout(children) {
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/" element={
          <ProtectedRoute>{withLayout(<Dashboard />)}</ProtectedRoute>
        } />
        <Route path="/stok" element={
          <ProtectedRoute>{withLayout(<Stock />)}</ProtectedRoute>
        } />
        <Route path="/mutasi" element={
          <ProtectedRoute>{withLayout(<StockMovement />)}</ProtectedRoute>
        } />
        <Route path="/riwayat" element={
          <ProtectedRoute>{withLayout(<History />)}</ProtectedRoute>
        } />
        <Route path="/scan" element={
          <ProtectedRoute>{withLayout(<ScanKeluar />)}</ProtectedRoute>
        } />

        <Route path="/transfer" element={
          <ProtectedRoute adminOnly>{withLayout(<Transfer />)}</ProtectedRoute>
        } />
        <Route path="/master-posm" element={
          <ProtectedRoute adminOnly>{withLayout(<MasterPosm />)}</ProtectedRoute>
        } />
        <Route path="/barcode" element={
          <ProtectedRoute adminOnly>{withLayout(<BarcodePrint />)}</ProtectedRoute>
        } />
        <Route path="/master-gudang" element={
          <ProtectedRoute adminOnly>{withLayout(<MasterGudang />)}</ProtectedRoute>
        } />
        <Route path="/pengguna" element={
          <ProtectedRoute adminOnly>{withLayout(<UserManagement />)}</ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}
