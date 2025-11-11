interface BatchDeploymentDialogProps {
    isOpen: boolean
    stackCount: number
    selectedGuids?: string[]
    useGuidSelection: boolean
    onConfirm: () => void
    onCancel: () => void
    isDeploying: boolean
}

const BatchDeploymentDialog = ({
    isOpen,
    stackCount,
    selectedGuids,
    useGuidSelection,
    onConfirm,
    onCancel,
    isDeploying
}: BatchDeploymentDialogProps) => {
    if (!isOpen) {
        return null
    }

    const deploymentType = useGuidSelection ? 'Selected Access Codes' : 'Auto-Assignment'
    const guidList = selectedGuids || []

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
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflowY: 'auto',
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
                            🚀 Confirm Batch Stack Deployment
                        </h3>
                        <p style={{
                            margin: 0,
                            color: '#666',
                            fontSize: '0.9rem'
                        }}>
                            This action will deploy {stackCount} CloudFormation stack{stackCount > 1 ? 's' : ''} using {deploymentType.toLowerCase()}.
                        </p>
                    </div>

                    {/* Deployment Summary */}
                    <div style={{
                        backgroundColor: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        border: '1px solid #e9ecef'
                    }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <strong>Deployment Summary:</strong>
                        </div>
                        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <div><strong>Stack Count:</strong> {stackCount}</div>
                            <div><strong>Assignment Method:</strong> {deploymentType}</div>
                            <div><strong>Template:</strong> Configured CloudFormation Template</div>
                            <div><strong>Region:</strong> Configured via deployment-config.json</div>
                        </div>
                    </div>

                    {/* Access Code List (if using selection) */}
                    {useGuidSelection && guidList.length > 0 && (
                        <div style={{
                            backgroundColor: '#e3f2fd',
                            padding: '1rem',
                            borderRadius: '6px',
                            marginBottom: '1.5rem',
                            border: '1px solid #bbdefb'
                        }}>
                            <div style={{ marginBottom: '0.5rem', color: '#1976d2' }}>
                                <strong>Selected Access Codes ({guidList.length}):</strong>
                            </div>
                            <div style={{
                                maxHeight: '150px',
                                overflowY: 'auto',
                                backgroundColor: 'white',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                            }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                    gap: '0.25rem',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem'
                                }}>
                                    {guidList.map((guid, index) => (
                                        <div key={guid} style={{ padding: '0.25rem' }}>
                                            {index + 1}. {guid}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Resource Details */}
                    <div style={{
                        backgroundColor: '#e8f5e8',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        border: '1px solid #c3e6c3'
                    }}>
                        <div style={{ fontSize: '0.9rem', color: '#2e7d32' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>Resources per Stack:</strong>
                            </div>
                            <ul style={{ margin: '0', paddingLeft: '1.5rem' }}>
                                <li>EC2 Instance (t3.micro)</li>
                                <li>Security Group with SSH access</li>
                                <li>IAM Role and Instance Profile</li>
                                <li>CloudFormation stack metadata</li>
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
                                <li>Each deployment typically takes 3-5 minutes</li>
                                <li>Selected Access Codes will be marked as "in use" during deployment</li>
                                <li>You can monitor progress in the Access Code status table</li>
                                <li>Failed deployments may require manual cleanup</li>
                            </ul>
                        </div>
                    </div>

                    {/* Cost Estimate */}
                    <div style={{
                        backgroundColor: '#f0f8ff',
                        padding: '1rem',
                        borderRadius: '6px',
                        marginBottom: '1.5rem',
                        border: '1px solid #b3d9ff'
                    }}>
                        <div style={{ fontSize: '0.9rem', color: '#0066cc' }}>
                            <strong>💰 Estimated Cost:</strong>
                            <div style={{ marginTop: '0.5rem' }}>
                                Approximately $0.01-0.02 USD per hour per stack (t3.micro instances in Singapore region)
                            </div>
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
                            {isDeploying ? 'Deploying...' : `Deploy ${stackCount} Stack${stackCount > 1 ? 's' : ''}`}
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

export default BatchDeploymentDialog