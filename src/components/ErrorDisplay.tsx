import { AppError, formatErrorForDisplay, isRetryableError } from '../utils/errorHandling';

interface ErrorDisplayProps {
    error: any;
    onRetry?: () => void;
    onDismiss?: () => void;
    className?: string;
    showRetryButton?: boolean;
    showDismissButton?: boolean;
}

const ErrorDisplay = ({
    error,
    onRetry,
    onDismiss,
    className = '',
    showRetryButton = true,
    showDismissButton = false
}: ErrorDisplayProps) => {
    if (!error) return null;

    const errorMessage = formatErrorForDisplay(error);
    const canRetry = showRetryButton && onRetry && isRetryableError(error);
    const isAppError = error instanceof AppError;

    const getErrorIcon = () => {
        if (isAppError && error.code?.includes('TIMEOUT')) {
            return '⏱️';
        }
        if (isAppError && error.code?.includes('CONNECTION')) {
            return '🔌';
        }
        if (isAppError && error.code?.includes('UNAUTHORIZED')) {
            return '🔒';
        }
        if (isAppError && error.code?.includes('NOT_FOUND')) {
            return '🔍';
        }
        if (isAppError && error.code?.includes('VALIDATION')) {
            return '⚠️';
        }
        return '❌';
    };

    const getErrorSeverity = () => {
        if (isAppError) {
            if (error.code?.includes('VALIDATION') || error.code?.includes('REQUIRED')) {
                return 'warning';
            }
            if (error.code?.includes('UNAUTHORIZED') || error.code?.includes('FORBIDDEN')) {
                return 'error';
            }
            if (error.retryable) {
                return 'info';
            }
        }
        return 'error';
    };

    const severity = getErrorSeverity();
    const baseStyles = {
        padding: '0.75rem 1rem',
        borderRadius: '4px',
        border: '1px solid',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem'
    };

    const severityStyles = {
        error: {
            backgroundColor: '#f8d7da',
            borderColor: '#f5c6cb',
            color: '#721c24'
        },
        warning: {
            backgroundColor: '#fff3cd',
            borderColor: '#ffeaa7',
            color: '#856404'
        },
        info: {
            backgroundColor: '#d1ecf1',
            borderColor: '#bee5eb',
            color: '#0c5460'
        }
    };

    const combinedStyles = {
        ...baseStyles,
        ...severityStyles[severity]
    };

    return (
        <div style={combinedStyles} className={className}>
            <div style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                {getErrorIcon()}
            </div>

            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {severity === 'error' ? 'Error' :
                        severity === 'warning' ? 'Warning' : 'Notice'}
                </div>

                <div style={{ marginBottom: canRetry || showDismissButton ? '0.75rem' : '0' }}>
                    {errorMessage}
                </div>

                {isAppError && error.code && (
                    <div style={{
                        fontSize: '0.8rem',
                        opacity: 0.8,
                        fontFamily: 'monospace',
                        marginBottom: canRetry || showDismissButton ? '0.5rem' : '0'
                    }}>
                        Error Code: {error.code}
                    </div>
                )}

                {(canRetry || showDismissButton) && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {canRetry && (
                            <button
                                onClick={onRetry}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.9rem',
                                    backgroundColor: severity === 'error' ? '#dc3545' :
                                        severity === 'warning' ? '#ffc107' : '#17a2b8',
                                    color: severity === 'warning' ? '#212529' : 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                🔄 Try Again
                            </button>
                        )}

                        {showDismissButton && onDismiss && (
                            <button
                                onClick={onDismiss}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    fontSize: '0.9rem',
                                    backgroundColor: 'transparent',
                                    color: 'inherit',
                                    border: '1px solid currentColor',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'opacity 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.8'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                ✕ Dismiss
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ErrorDisplay;