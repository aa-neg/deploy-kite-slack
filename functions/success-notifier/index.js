const request = require('../../utils/request')
const baseSlackPath = 'https://hooks.slack.com/services'
const baseRepoUrl = 'https://github.com/siteminder-au/'
const baseBuildKiteUrl = 'https://buildkite.com/siteminder/'
const baseSlackUrl = 'hooks.slack.com'

const footerIconUrl = process.env.FOOTER_ICON_URL
const slackWebhookPath = process.env.SLACK_WEBHOOK_PATH
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

const determineTitle = (failureText, slackstate) => {
  if (failureText) {
    if (slackstate.redeployment) {
      return `Failed to redeploy ${slackstate.timestamp}`
    } else {
      return `Failed to deploy`
    }
  } else {
    if (slackstate.redeployment) {
      return `Successfully redeployed ${slackstate.timestamp}`
    } else {
      return `Successfully deployed`
    }
  }
}

const determimeColour = (failureText, slackstate) => {
  if (failureText) {
    if (slackstate.redeployment) {
      return '#ff9605'
    } else {
      return '#FF0000'
    }
  } else {
    if (slackstate.redeployment) {
      return '#cdff05'
    } else {
      return '#36a64f'
    }
  }
}

const baseMessage = (
  application,
  buildNumber,
  environment,
  redeployment,
  timestamp,
  callbackId,
  failureText
) => {
  const slackstate = {
    redeployment: redeployment,
    timestamp: timestamp
  }
  console.log('our slack state: ', slackstate)
  const slackMessage = {
    attachments: [
      {
        fallback: `Deployed ${application} ${buildNumber} to ${environment}`,
        color: determimeColour(failureText, slackstate),
        title: determineTitle(failureText, slackstate),
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

  console.log('our base slack message: ', slackMessage)

  return slackMessage
}

const generateSlackMessage = (err, payload) => {
  if (payload) {
    return baseMessage(
      payload.pipeline,
      payload.buildnumber,
      payload.env,
      payload.redeployment,
      payload.timestamp,
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

    return request
      .post(
        {
          hostname: baseSlackUrl,
          path: slackWebhookPath
        },
        generateSlackMessage(parsedMessage.error, parsedMessage.payload)
      )
      .then(result => {
        callback()
      })
      .catch(err => {
        console.log('Failed to send slack message: ', err)
        callback()
      })
  }
}
