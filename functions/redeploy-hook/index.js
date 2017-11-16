const AWS = require('aws-sdk')
const SQS = new AWS.SQS({ region: 'us-west-2' })
const URL = require('url')
const queryString = require('querystring')
const request = require('../../utils/request')

const sqsQueueUrl = process.env.SQS_DEPLOY_QUEUE
const footerIconUrl = process.env.FOOTER_ICON_URL

const sendSqsMessage = (url, message) => {
  return new Promise((resolve, reject) => {
    SQS.sendMessage(
      {
        QueueUrl: url,
        MessageBody: message
      },
      function(err, data) {
        if (err) {
          reject(err)
        } else {
          resolve(err)
        }
      }
    )
  })
}

const constructSuccessMessage = messageDetails => {
  console.log('our message details: ', messageDetails)
  const baseMessage = {
    attachments: [
      {
        fallback: `Successfully redeployed`,
        color: '#05f2ff',
        title: `Sent redeploy. ${messageDetails.timestamp}`,
        text: `Sent ${messageDetails.pipeline} ${messageDetails.buildnumber} to the redeploy queue.`,
        callback_id: `${JSON.stringify(messageDetails)}`
      }
    ]
  }

  return baseMessage
}

const constructErrorMessage = (messageDetails, err) => {
  const baseMessage = {
    attachments: [
      {
        fallback: `Shit really went wrong in redeployment`,
        color: '#ffb805',
        title: `Failed to re-deploy! ${messageDetails.timestamp}`,
        text: `This went wrong: ${err.toString()}`,
        callback_id: `${JSON.stringify(messageDetails)}`,
        fields: [
          {
            title: 'Infrastructure Environment',
            value: `${messageDetails.env}`
          },
          {
            title: 'Application',
            value: `${messageDetails.pipeline}`,
            short: true
          },
          {
            title: 'Build',
            value: `${messageDetails.buildnumber}`,
            short: true
          }
        ],
        actions: [
          {
            name: 'redeploy',
            text: 'Try again...',
            style: 'danger',
            type: 'button',
            value: 'redeploy',
            confirm: {
              title:
                'Are you sure? You might have messed up earlier. This will override the current build',
              text: `To redeploy ${messageDetails.pipeline} build number: ${messageDetails.buildnumber}`,
              ok_text: 'Do it',
              dismiss_text: 'No'
            }
          }
        ],
        footer: 'Siteminder life oops',
        footer_icon: footerIconUrl
      }
    ]
  }

  return baseMessage
}

const postSlackMessage = (message, url, callback) => {
  console.log('our url', url)
  console.log('our message we plan to send: ', message)
  return request
    .post(
      {
        hostname: url.hostname,
        path: url.pathname
      },
      message
    )
    .then(result => {
      callback()
    })
    .catch(err => {
      console.log('sit went wrong posting to slack', err)
      callback()
    })
}

exports.handler = (event, context, callback) => {
  const payload = event
  console.log('our payload:', payload)
  if (!payload || !payload.callback_id) {
    callback(null, {
      statusCode: '400'
    })
  } else {
    const details = JSON.parse(payload.callback_id)
    console.log('our details: ', details)
    const url = URL.parse(payload.response_url)
    details.redeployment = true
    details.timestamp = new Date().getTime()
    return sendSqsMessage(sqsQueueUrl, JSON.stringify(details))
      .then(result => {
        return postSlackMessage(constructSuccessMessage(details), url, callback)
      })
      .catch(err => {
        console.log('shit went wrong: ', err)
        return postSlackMessage(
          constructErrorMessage(details, err),
          url,
          callback
        )
      })
  }
}
