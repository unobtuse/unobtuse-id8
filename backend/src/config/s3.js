const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_BUCKET || 'gabemade';
const FOLDER_PREFIX = 'id8/';

const uploadToS3 = async (file, key) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `${FOLDER_PREFIX}${key}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  });
  
  await s3Client.send(command);
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${FOLDER_PREFIX}${key}`;
};

const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key.replace(`https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/`, ''),
  });
  
  await s3Client.send(command);
};

module.exports = { s3Client, uploadToS3, deleteFromS3, BUCKET_NAME, FOLDER_PREFIX };
