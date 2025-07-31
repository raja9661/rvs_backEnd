const issueTemplate = ({ sub, issue })=>{
    return `
        <div>
            <p>Dear Support Team,</p>
            <p>Please find the issue details: </p>
	    <p>Subject: ${ sub }</p>
            <div>
                ${ issue }
            </div>
            <br />
            <p>Thanks,</p>
            <p>[This is an automatically system generated email, please do not reply.]</p>
            <br />
            <p>© RVSDOC. All Rights Reserved.
            <br />New Delhi, India</p>
        </div>
    `
}

module.exports = issueTemplate;
