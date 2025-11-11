import React from 'react'

interface GuidelineStep {
    stepNumber: number
    title: string
    description: string
    screenshotUrl?: string
    screenshotAlt?: string
}

interface CloudFormationLaunchConfig {
    stackName: string
    templateUrl: string
    region: string
    consoleBaseUrl: string
}

interface GuidelinesSectionProps {
    title: string
    isExpanded?: boolean // Made optional since it's no longer used
    onToggle?: () => void // Made optional since it's no longer used
    guidelines: GuidelineStep[]
    tabType: 'self-deploy' | 'participant-code'
    launchConfig?: CloudFormationLaunchConfig
    onLaunchStack?: () => void
}

const GuidelinesSection: React.FC<GuidelinesSectionProps> = ({
    title,
    guidelines,
    tabType,
}) => {
    return (
        <div style={{
            marginTop: '2rem',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            <div
                style={{
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#495057'
                }}
            >
                <span>{title}</span>
            </div>

            <div
                id={`guidelines-content-${tabType}`}
                style={{
                    padding: '0 1rem 1rem 1rem',
                    borderTop: '1px solid #dee2e6'
                }}
            >
                <div style={{ marginTop: '1rem' }}>
                    {guidelines.map((step) => (
                        <div
                            key={step.stepNumber}
                            style={{
                                marginBottom: '1.5rem',
                                paddingBottom: '1.5rem',
                                borderBottom: step.stepNumber < guidelines.length ? '1px solid #e9ecef' : 'none'
                            }}
                        >
                            <h4 style={{
                                margin: '0 0 0.5rem 0',
                                color: '#007bff',
                                fontSize: '1rem'
                            }}>
                                Step {step.stepNumber}: {step.title}
                            </h4>
                            <p
                                style={{
                                    margin: '0 0 1rem 0',
                                    color: '#495057',
                                    lineHeight: '1.5'
                                }}
                                dangerouslySetInnerHTML={{ __html: step.description }}
                            />

                            {step.screenshotUrl && (
                                <div style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    padding: '0.5rem',
                                    textAlign: 'center'
                                }}>
                                    <img
                                        src={step.screenshotUrl}
                                        alt={step.screenshotAlt || `Screenshot for step ${step.stepNumber}`}
                                        style={{
                                            maxWidth: '100%',
                                            height: 'auto',
                                            borderRadius: '2px'
                                        }}
                                        onError={(e) => {
                                            // Hide broken images and show placeholder
                                            const target = e.target as HTMLImageElement
                                            target.style.display = 'none'
                                            const placeholder = target.nextSibling as HTMLElement
                                            if (placeholder) {
                                                placeholder.style.display = 'block'
                                            }
                                        }}
                                    />
                                    <div
                                        style={{
                                            display: 'none',
                                            padding: '2rem',
                                            color: '#6c757d',
                                            fontStyle: 'italic'
                                        }}
                                    >
                                        Screenshot placeholder - Image will be added soon
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default GuidelinesSection
