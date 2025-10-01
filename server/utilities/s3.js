const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const generatePresignedUrl = async (bucketName, objectKey, expirationHours = 72) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: objectKey,
      Expires: expirationHours * 60 * 60, // Convert hours to seconds
      ResponseContentDisposition: 'inline', // This allows viewing in browser
      ResponseContentType: 'application/dicom' // Set proper content type for DICOM
    };

    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw error;
  }
};

module.exports = {
  generatePresignedUrl
};