import { AccessCodeStatus } from '../types'

interface StackDeletionDialogProps {
    isOpen: boolean;
    accessCodeStatus: AccessCodeStatus | null;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting: boolean;
}

const StackDeletionDialog = ({
    isOpen,
    accessCodeStatus,
    onConfirm,
    onCancel,
    isDeleting
}: StackDeletionDialogProps) => {
    if (!isOpen || !accessCodeStatus) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
                <h3 style={{
                    margin: '0 0 1rem 0',
                    color: '#dc3545',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                    Confirm Stack Deletion
                </h3>

                <div style={{ marginBottom: '1.5rem' }}>
                    <p style={{ margin: '0 0 1rem 0' }}>
                        You are about to delete the following CloudFormation stack:
                    </p>

                    <div style={{
                        backgroundColor: '#f8f9fa',
                        padding: '1rem',
                        borderRadius: '4px',
                        border: '1px solid #dee2e6'
                    }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Access Code:</strong>
                            <span style={{
                                fontFamily: 'monospace',
                                marginLeft: '0.5rem',
                                fontSize: '0.9rem'
                            }}>
                                {accessCodeStatus.accessCode}
                            </span>
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Stack Name:</strong>
                            <span style={{
                                fontFamily: 'monospace',
                                marginLeft: '0.5rem',
                                fontSize: '0.9rem'
                            }}>
                                {accessCodeStatus.stackName}
                            </span>
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Status:</strong>
                            <span style={{ marginLeft: '0.5rem' }}>
                                {accessCodeStatus.status}
                            </span>
                        </div>
                        {accessCodeStatus.createdAt && (
                            <div>
                                <strong>Created:</strong>
                                <span style={{ marginLeft: '0.5rem' }}>
                                    {accessCodeStatus.createdAt.toLocaleString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {accessCodeStatus.status === 'DELETE_IN_PROGRESS' ? (
                        <div style={{
                            backgroundColor: '#f8d7da',
                            color: '#721c24',
                            padding: '1rem',
                            borderRadius: '4px',
                            border: '1px solid #f5c6cb',
                            marginTop: '1rem'
                        }}>
                            <strong>Cannot Delete:</strong> This stack is already being deleted.
                            Please wait for the current deletion process to complete.
                        </div>
                    ) : accessCodeStatus.status === 'CREATE_IN_PROGRESS' ? (
                        <div style={{
                            backgroundColor: '#f8d7da',
                            color: '#721c24',
                            padding: '1rem',
                            borderRadius: '4px',
                            border: '1px solid #f5c6cb',
                            marginTop: '1rem'
                        }}>
                            <strong>Cannot Delete:</strong> This stack is currently being created.
                            Please wait for creation to complete before attempting deletion.
                        </div>
                    ) : (
                        <div style={{
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            padding: '1rem',
                            borderRadius: '4px',
                            border: '1px solid #ffeaa7',
                            marginTop: '1rem'
                        }}>
                            <strong>Warning:</strong> This action cannot be undone. All resources
                            created by this stack will be permanently deleted. The Access Code will
                            become available for reuse once deletion is complete.
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: isDeleting ? 0.6 : 1
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting || accessCodeStatus.status === 'DELETE_IN_PROGRESS' || accessCodeStatus.status === 'CREATE_IN_PROGRESS'}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: (isDeleting || accessCodeStatus.status === 'DELETE_IN_PROGRESS' || accessCodeStatus.status === 'CREATE_IN_PROGRESS') ? 0.6 : 1
                        }}
                    >
                        {isDeleting ? 'Deleting...' :
                            accessCodeStatus.status === 'DELETE_IN_PROGRESS' ? 'Already Deleting' :
                                accessCodeStatus.status === 'CREATE_IN_PROGRESS' ? 'Cannot Delete' :
                                    'Delete Stack'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StackDeletionDialog;