import { Routes, Route } from 'react-router-dom'
import PublicViewer from './components/PublicViewer'
import AdminDashboard from './components/AdminDashboard'
import AdminLogin from './components/AdminLogin'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
    return (
        <div className="App">
            <Routes>
                {/* Public route for stack output details viewing */}
                <Route path="/" element={<PublicViewer />} />

                {/* Admin login route */}
                <Route path="/admin/login" element={<AdminLogin />} />

                {/* Protected admin dashboard route */}
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </div>
    )
}

export default App