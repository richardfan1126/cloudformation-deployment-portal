import { AccessCodeStatus } from '../types'

interface StackDeploymentDialogProps {
    isOpen: boolean
    accessCodeStatus: AccessCodeStatus | null
    onConfirm: () => void
    onCancel: () => void
    isDeploying: boolean
}

const StackDeploymentDialog = ({
    isOpen,
    accessCodeStatus,
    onConfirm,
    onCancel,
    isDeploying
}: StackDeploymentDialogProps) => {
    if (!isOpen || !accessCodeStatus) {
        return null
    }

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                onClick={onCancel}
            >
                {/* Dialog */}
                <div
                    style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        padding: '2rem',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        position: 'relative'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{
                            margin: '0 0 0.5rem 0',
                            color: '#333',
                            fontSize: '1.25rem'
                        }}>
                            🚀 Confirm Stack Deployment
                        </h3>
                        <p style={{
                            margin: 0,
                            color: '#666',
                            fontSize: '0.9rem'
                        }}>
                            This action will deploy a new CloudFormation stack to the selected Access Code.
                        </p>
                    </div>

                    {/* Access Code Info */}
                    <div style={{
                        backgroundColor: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        border: '1px solid #e9ecef'
                    }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Target Access Code:</strong>
                        </div>
                        <div style={{
                            fontFamily: 'monospace',
                            fontSize: '0.9rem',
                            backgroundColor: 'white',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                        }}>
                            {accessCodeStatus.accessCode}
                        </div>
                    </div>

                    {/* Deployment Details */}
                    <div style={{
                        backgroundColor: '#e3f2fd',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        border: '1px solid #bbdefb'
                    }}>
                        <div style={{ fontSize: '0.9rem', color: '#1976d2' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>Deployment Details:</strong>
                            </div>
                            <ul style={{ margin: '0', paddingLeft: '1.5rem' }}>
                                <li>Template: CloudFormation Deployment Template</li>
                                <li>Stack Name: deployment-stack-{accessCodeStatus.accessCode}-[timestamp]</li>
                                <li>Resources: As defined in template</li>
                                <li>Region: Configured region</li>
                            </ul>
                        </div>
                    </div>

                    {/* Warning */}
                    <div style={{
                        backgroundColor: '#fff3cd',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        border: '1px solid #ffeaa7'
                    }}>
                        <div style={{ fontSize: '0.9rem', color: '#856404' }}>
                            <strong>⚠️ Important:</strong>
                            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                                <li>This will create AWS resources that may incur costs</li>
                                <li>The deployment process typically takes 3-5 minutes</li>
                                <li>The Access Code will be marked as "in use" during deployment</li>
                                <li>You can monitor progress in the Access Code status table</li>
                            </ul>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        justifyContent: 'flex-end'
                    }}>
                        <button
                            onClick={onCancel}
                            disabled={isDeploying}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                opacity: isDeploying ? 0.6 : 1
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeploying}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                opacity: isDeploying ? 0.6 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {isDeploying && (
                                <span style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid white',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                            )}
                            {isDeploying ? 'Deploying...' : 'Deploy Stack'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Spinner animation */}
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
        </>
    )
}

export default StackDeploymentDialog