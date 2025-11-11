import { Navigate } from 'react-router-dom'
import { ReactNode, useEffect, useState } from 'react'
import { getCurrentUser } from 'aws-amplify/auth'

interface ProtectedRouteProps {
    children: ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

    useEffect(() => {
        const checkAuth = async () => {
            try {
                await getCurrentUser()
                setIsAuthenticated(true)
            } catch {
                setIsAuthenticated(false)
            }
        }
        checkAuth()
    }, [])

    if (isAuthenticated === null) {
        return <div>Loading...</div>
    }

    if (!isAuthenticated) {
        return <Navigate to="/admin/login" replace />
    }

    return <>{children}</>
}

export default ProtectedRoute