const AWS = require('aws-sdk')
const queryString = require('querystring')
AWS.config.update({ region: process.env.AWS_REGION })
const lambda = new AWS.Lambda()

exports.handler = (event, context, callback) => {
  const requestDetails = JSON.parse(queryString.parse(event.body).payload)
  if (requestDetails.callback_id) {
    lambda.invoke(
      {
        FunctionName: process.env.HOP_FUNCTION,
        Payload: JSON.stringify(requestDetails),
        InvocationType: 'Event'
      },
      function(error, data) {
        callback(null, {
          statusCode: '200',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      }
    )
  } else {
    console.log('Failed to parse: ', requestDetails)
  }
}
