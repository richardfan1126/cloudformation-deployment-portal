import { StackOutput } from '../types'

interface OutputDisplayProps {
    outputs: StackOutput[]
    guid: string
}

// Helper function to get user-friendly labels for output keys
const getDisplayLabel = (outputKey: string): string => {
    const labelMap: Record<string, string> = {
        'PublicIP': '🌐 Public IP Address',
        'InstanceLoginUsername': '👤 Username',
        'InstanceLoginPassword': '🔐 Password',
        'InstanceId': '🖥️ EC2 Instance ID',
        'PrivateIP': '🔒 Private IP Address',
        'PublicDNS': '🌐 Public DNS Name',
        'PrivateDNS': '🔒 Private DNS Name',
        'SSHCommand': '💻 SSH Connection Command',
        'KeyPairName': '🔑 Key Pair Name',
        'SecurityGroupId': '🛡️ Security Group ID',
        'InstanceType': '⚙️ Instance Type',
        'AvailabilityZone': '📍 Availability Zone',
        'VpcId': '🏗️ VPC ID',
        'SubnetId': '🏗️ Subnet ID',
        'Username': '👤 Username',
        'Password': '🔐 Password',
        'LoginURL': '🔗 Login URL',
        'WebURL': '🌐 Web Interface URL'
    }

    return labelMap[outputKey] || `📄 ${outputKey}`
}

// Helper function to format output values based on their type
const formatOutputValue = (outputKey: string, outputValue: string): string => {
    // For SSH commands, make them more readable
    if (outputKey.toLowerCase().includes('ssh') || outputKey.toLowerCase().includes('command')) {
        return outputValue.replace(/ssh\s+/, 'ssh ')
    }

    // For URLs, keep them as-is
    if (outputKey.toLowerCase().includes('url') || outputValue.startsWith('http')) {
        return outputValue
    }

    return outputValue
}

// Helper function to determine if a value should be copyable
const isCopyableValue = (outputKey: string): boolean => {
    const copyableKeys = [
        'PublicIP', 'InstanceLoginUsername', 'InstanceLoginPassword',
        'InstanceId', 'PrivateIP', 'PublicDNS', 'PrivateDNS',
        'SSHCommand', 'KeyPairName', 'SecurityGroupId', 'Username',
        'Password', 'LoginURL', 'WebURL'
    ]
    return copyableKeys.some(key => outputKey.toLowerCase().includes(key.toLowerCase()))
}

// Helper function to determine if a value is long and should break
const isLongValue = (value: string): boolean => {
    return value.length > 50
}

// Helper function to copy text to clipboard
const copyToClipboard = async (text: string): Promise<void> => {
    try {
        await navigator.clipboard.writeText(text)
        // You could add a toast notification here
    } catch (err) {
        console.error('Failed to copy text: ', err)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
    }
}

// Helper function to sort outputs in the desired order
const sortOutputs = (outputs: StackOutput[]): StackOutput[] => {
    const priorityOrder = ['PublicIP', 'InstanceLoginUsername', 'InstanceLoginPassword']

    const priorityOutputs: StackOutput[] = []
    const otherOutputs: StackOutput[] = []

    // First, collect outputs in priority order
    priorityOrder.forEach(key => {
        const output = outputs.find(o => o.outputKey === key)
        if (output) {
            priorityOutputs.push(output)
        }
    })

    // Then collect all other outputs
    outputs.forEach(output => {
        if (!priorityOrder.includes(output.outputKey)) {
            otherOutputs.push(output)
        }
    })

    // Return priority outputs first, then others
    return [...priorityOutputs, ...otherOutputs]
}

const OutputDisplay = ({ outputs, guid }: OutputDisplayProps) => {
    if (!outputs || outputs.length === 0) {
        return (
            <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '1.5rem',
                textAlign: 'center'
            }}>
                <h3 style={{ color: '#6c757d', marginBottom: '0.5rem' }}>No CloudFormation Outputs Available</h3>
                <p style={{ color: '#6c757d', margin: '0' }}>
                    The CloudFormation stack is still being created or does not have outputs configured yet.
                </p>
            </div>
        )
    }

    return (
        <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: '#28a745' }}>
                ✓ Stack Outputs for Access Code: {guid}
            </h3>

            <div style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                {sortOutputs(outputs).map((output, index) => (
                    <div
                        key={output.outputKey}
                        style={{
                            padding: '1rem',
                            borderBottom: index < outputs.length - 1 ? '1px solid #dee2e6' : 'none',
                            backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                        }}
                    >
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#495057', fontSize: '1.1rem' }}>
                                {getDisplayLabel(output.outputKey)}
                            </strong>
                        </div>

                        <div style={{
                            backgroundColor: '#e9ecef',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.95rem',
                            color: '#495057',
                            wordBreak: isLongValue(output.outputValue) ? 'break-all' : 'normal',
                            marginBottom: output.description ? '0.5rem' : '0',
                            position: 'relative'
                        }}>
                            {formatOutputValue(output.outputKey, output.outputValue)}
                            {isCopyableValue(output.outputKey) && (
                                <button
                                    onClick={() => copyToClipboard(output.outputValue)}
                                    style={{
                                        position: 'absolute',
                                        top: '0.5rem',
                                        right: '0.5rem',
                                        background: 'rgba(0,0,0,0.1)',
                                        border: 'none',
                                        borderRadius: '3px',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        color: '#495057'
                                    }}
                                    title="Copy to clipboard"
                                >
                                    📋
                                </button>
                            )}
                        </div>

                        {output.description && (
                            <div style={{
                                fontSize: '0.9rem',
                                color: '#6c757d',
                                fontStyle: 'italic'
                            }}>
                                {output.description}
                            </div>
                        )}
                    </div>
                ))}
            </div>


        </div>
    )
}

export default OutputDisplay