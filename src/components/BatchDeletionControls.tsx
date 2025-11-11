import { useState } from 'react'
import { AccessCodeStatus } from '../types'

interface BatchDeletionControlsProps {
    guidStatuses: AccessCodeStatus[]
    onDeleteAll: () => void
    isDeletingAll: boolean
}

interface StackToDelete {
    accessCode: string
    stackName: string
    createdAt: Date
}

const BatchDeletionControls = ({
    guidStatuses,
    onDeleteAll,
    isDeletingAll
}: BatchDeletionControlsProps) => {
    const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
    const [confirmationChecked, setConfirmationChecked] = useState(false)

    // Get all active stacks that can be deleted
    const getActiveStacks = (): StackToDelete[] => {
        return guidStatuses
            .filter(status => status.isLinked && status.stackName)
            .map(status => ({
                accessCode: status.accessCode,
                stackName: status.stackName!,
                createdAt: status.createdAt || new Date()
            }))
    }

    const activeStacks = getActiveStacks()
    const hasActiveStacks = activeStacks.length > 0

    const handleDeleteAllClick = () => {
        setConfirmationChecked(false)
        setShowConfirmationDialog(true)
    }

    const handleConfirmDelete = () => {
        if (confirmationChecked) {
            setShowConfirmationDialog(false)
            setConfirmationChecked(false)
            onDeleteAll()
        }
    }

    const handleCancelDelete = () => {
        setShowConfirmationDialog(false)
        setConfirmationChecked(false)
    }

    const formatDate = (date: Date) => {
        return date.toLocaleString()
    }

    return (
        <>
            <div style={{ marginBottom: '1rem' }}>
                <button
                    onClick={handleDeleteAllClick}
                    disabled={!hasActiveStacks || isDeletingAll}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: hasActiveStacks && !isDeletingAll ? '#dc3545' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: hasActiveStacks && !isDeletingAll ? 'pointer' : 'not-allowed',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                    title={
                        !hasActiveStacks
                            ? 'No active stacks to delete'
                            : isDeletingAll
                                ? 'Bulk deletion in progress'
                                : `Delete all ${activeStacks.length} active stack(s)`
                    }
                >
                    {isDeletingAll && (
                        <span style={{
                            width: '16px',
                            height: '16px',
                            border: '2px solid white',
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                    )}
                    🗑️ Delete All Stacks
                    {hasActiveStacks && !isDeletingAll && (
                        <span style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            fontSize: '0.8rem'
                        }}>
                            {activeStacks.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmationDialog && (
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
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}>
                        <h3 style={{
                            margin: '0 0 1rem 0',
                            color: '#dc3545',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            ⚠️ Confirm Bulk Stack Deletion
                        </h3>

                        <div style={{
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            padding: '1rem',
                            borderRadius: '4px',
                            marginBottom: '1rem',
                            border: '1px solid #ffeaa7'
                        }}>
                            <strong>Warning:</strong> This action will permanently delete all active CloudFormation stacks.
                            This operation cannot be undone and will destroy all resources created by these stacks.
                        </div>

                        <p style={{ marginBottom: '1rem' }}>
                            The following <strong>{activeStacks.length}</strong> stack(s) will be deleted:
                        </p>

                        <div style={{
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            marginBottom: '1.5rem'
                        }}>
                            <table style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: '0.9rem'
                            }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                                        <th style={{
                                            padding: '0.5rem',
                                            textAlign: 'left',
                                            borderBottom: '1px solid #ddd',
                                            position: 'sticky',
                                            top: 0,
                                            backgroundColor: '#f8f9fa'
                                        }}>
                                            Access Code
                                        </th>
                                        <th style={{
                                            padding: '0.5rem',
                                            textAlign: 'left',
                                            borderBottom: '1px solid #ddd',
                                            position: 'sticky',
                                            top: 0,
                                            backgroundColor: '#f8f9fa'
                                        }}>
                                            Stack Name
                                        </th>
                                        <th style={{
                                            padding: '0.5rem',
                                            textAlign: 'left',
                                            borderBottom: '1px solid #ddd',
                                            position: 'sticky',
                                            top: 0,
                                            backgroundColor: '#f8f9fa'
                                        }}>
                                            Created At
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStacks.map((stack, index) => (
                                        <tr key={stack.accessCode} style={{
                                            backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa'
                                        }}>
                                            <td style={{
                                                padding: '0.5rem',
                                                borderBottom: '1px solid #eee',
                                                fontFamily: 'monospace',
                                                fontSize: '0.8rem'
                                            }}>
                                                {stack.accessCode}
                                            </td>
                                            <td style={{
                                                padding: '0.5rem',
                                                borderBottom: '1px solid #eee',
                                                fontFamily: 'monospace',
                                                fontSize: '0.8rem'
                                            }}>
                                                {stack.stackName}
                                            </td>
                                            <td style={{
                                                padding: '0.5rem',
                                                borderBottom: '1px solid #eee'
                                            }}>
                                                {formatDate(stack.createdAt)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                        }}>
                            <input
                                type="checkbox"
                                id="confirmDeletion"
                                checked={confirmationChecked}
                                onChange={(e) => setConfirmationChecked(e.target.checked)}
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    cursor: 'pointer'
                                }}
                            />
                            <label
                                htmlFor="confirmDeletion"
                                style={{
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    color: '#dc3545'
                                }}
                            >
                                I understand this action cannot be undone
                            </label>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={handleCancelDelete}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={!confirmationChecked}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: confirmationChecked ? '#dc3545' : '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: confirmationChecked ? 'pointer' : 'not-allowed',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                Delete All {activeStacks.length} Stack(s)
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

export default BatchDeletionControls