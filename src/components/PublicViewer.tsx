import ParticipantCodeTab from './ParticipantCodeTab'

const PublicViewer = () => {
    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
            <h1>CloudFormation Deployment Portal</h1>

            <ParticipantCodeTab />
        </div>
    )
}

export default PublicViewer