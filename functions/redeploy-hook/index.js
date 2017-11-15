const AWS = require('aws-sdk')
const SQS = new AWS.SQS({ region: 'us-west-2' })
const queryString = require('querystring')

const sqsQueueUrl = process.env.SQS_DEPLOY_QUEUE

const sendSqsMessage = (url, message) => {
  return new Promise((resolve, reject) => {
    SQS.sendMessage(
      {
        QueueUrl: url,
        MessageBody: message,
        DelaySeconds: 0
      },
      (err, data) => {
        if (err) {
          return Promise.reject(err)
        } else {
          return Promise.resolve(data)
        }
      }
    )
  })
}

const constructSuccessMessage = payload => {
  const messageDetails = JSON.parse(payload)
  return {
    attachments: [
      {
        fallback: `Successfully redeployed`,
        color: '#05f2ff',
        title: 'Sent redeploy.',
        text: `Sent ${messageDetails.pipeline} ${messageDetails.buildnumber} to the redeploy queue.`,
        callback_id: `${payload.callback_id}`,
        footer: 'Siteminder life oops',
        footer_icon: footerIconUrl
      }
    ]
  }
}

const constructErrorMessage = (payload, err) => {
  const messageDetails = JSON.parse(payload)
  return {
    attachments: [
      {
        fallback: `Shit really went wrong in redeployment`,
        color: '#ffb805',
        title: 'Failed to re-deploy!',
        text: `This went wrong: ${err.toString()}`,
        callback_id: `${payload.callback_id}`,
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
}

exports.handler = (event, context, callback) => {
  const payload = JSON.parse(queryString.parse(event.body).payload)
  console.log('parsed payload: ', payload)
  if (!payload || !payload.callback_id) {
    callback(null, {
      statusCode: '400'
    })
  } else {
    const details = payload.callback_id
    sendSqsMessage(sqsQueueUrl, details)
      .then(result => {
        callback(null, {
          statusCode: '200',
          body: constructSuccessMessage(details),
          headers: {
            'Content-Type': 'application/json'
          }
        })
      })
      .catch(err => {
        callback(null, {
          statusCode: '200',
          body: constructErrorMessage(details, err),
          headers: {
            'Content-Type': 'application/json'
          }
        })
      })
  }
}
