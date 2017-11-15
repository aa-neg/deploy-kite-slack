const request = require('request-promise')
const baseSlackPath = 'https://hooks.slack.com/services'
const baseRepoUrl = 'https://github.com/siteminder-au/'
const baseBuildKiteUrl = 'https://buildkite.com/siteminder/'

const footerIconUrl = process.env.FOOTER_ICON_URL
const slackWebhook = process.env.SLACK_WEBHOOK
const desiredSubject = process.env.SNS_SUBJECT

const constructRepoLink = application => {
  return `${baseRepoUrl}${application}`
}

const constructBuildKiteLink = (application, buildNumber) => {
  return `${baseBuildKiteUrl}${application}/builds/${buildNumber}`
}

const constructCallbackId = () => {
  return 'test123'
}

const baseMessage = (
  application,
  buildNumber,
  environment,
  callbackId,
  failureText
) => {
  const slackMessage = {
    attachments: [
      {
        fallback: `Deployed ${application} ${buildNumber} to ${environment}`,
        color: failureText ? '#FF0000' : '#36a64f',
        title: failureText ? 'Failed to deploy!' : 'Successfully deployed',
        text: failureText,
        callback_id: `${callbackId}`,
        fields: [
          {
            title: 'Infrastructure Environment',
            value: `${environment}`
          },
          {
            title: 'Application',
            value: `${application}`,
            short: true
          },
          {
            title: 'Build',
            value: `${buildNumber}`,
            short: true
          },
          {
            title: 'Github',
            value: `${constructRepoLink(application)}`
          },
          {
            title: 'Build kite',
            value: `${constructBuildKiteLink(application, buildNumber)}`
          }
        ],
        footer: 'Siteminder life',
        actions: [
          {
            name: 'redeploy',
            text: 'Redeploy',
            style: failureText ? 'danger' : 'primary',
            type: 'button',
            value: 'redeploy',
            confirm: {
              title: 'Are you sure? This will override the current build',
              text: `To redeploy ${application} build number: ${buildNumber}`,
              ok_text: failureText ? 'Try it again :)' : 'Yep',
              dismiss_text: 'No'
            }
          }
        ],
        footer_icon: footerIconUrl
      }
    ]
  }

  return slackMessage
}

const generateSlackMessage = (err, payload) => {
  if (payload) {
    return baseMessage(
      payload.pipeline,
      payload.buildnumber,
      payload.env,
      JSON.stringify(payload),
      err
    )
  } else {
    return {
      attachments: [
        {
          fallback: `Shit really went wrong`,
          color: '#FF0000',
          title: 'Failed to deploy! We received no payload',
          text: 'Shit really went wrong!',
          callback_id: `error123`,
          footer: 'Siteminder life oops',
          footer_icon: footerIconUrl
        }
      ]
    }
  }
}

exports.handler = (event, context, callback) => {
  console.log('event records', event.Records[0].Sns)

  const snsEvent = event.Records[0].Sns

  if (
    !snsEvent ||
    !snsEvent.Subject ||
    snsEvent.Subject !== desiredSubject ||
    !snsEvent.Message
  ) {
    callback(`Invalid sns subject: ${snsEvent.Subject}`)
  } else {
    const parsedMessage = JSON.parse(snsEvent.Message)

    return request({
      method: 'POST',
      uri: `${slackWebhook}`,
      body: generateSlackMessage(parsedMessage.error, parsedMessage.payload),
      json: true
    })
      .then(result => {
        callback()
      })
      .catch(err => {
        console.log('Failed to send slack message: ', err)
        callback(err)
      })
  }
}
