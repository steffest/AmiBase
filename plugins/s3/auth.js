let Auth = function(){
    let me = {};

    me.init = function(config){
        return new Promise((next)=>{
            let storedCredentials = {
                AccessKeyId: localStorage.getItem("aws_a"),
                SecretAccessKey: localStorage.getItem("aws_s"),
                SessionToken: localStorage.getItem("aws_t")
            }

            if (storedCredentials.AccessKeyId && storedCredentials.SecretAccessKey && storedCredentials.SessionToken){
                console.log("using stored credentials");
                next(storedCredentials);
            }else{
                if (!config){
                    next(false);
                    return;
                }
                console.log("generating temporary token");
                var sts = new AWS.STS({
                    accessKeyId: config.login,
                    secretAccessKey: config.pass,
                    sslEnabled: true,
                    apiVersion: '2011-06-15'
                });

                var policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Action": [
                                "s3:DeleteObject",
                                "s3:GetObject",
                                "s3:GetObjectAcl",
                                "s3:ListBucket",
                                "s3:PutObject",
                                "s3:PutObjectAcl",
                                "s3:GetBucketLocation"
                            ],
                            "Resource": [
                                "arn:aws:s3:::" + config.url,
                                "arn:aws:s3:::" + config.url + "/*"
                            ]
                        }
                    ]
                }

                var stsParams = {
                    Name: 'AmiBase-S3',
                    Policy: JSON.stringify(policy),
                    // Duration of 36 hours
                    DurationSeconds: 129600,
                };

                sts.getFederationToken(stsParams, function(err, data) {
                    if (err){
                        console.error(err);
                        next();
                    }else{
                        let c=data.Credentials;
                        localStorage.setItem("aws_a",c.AccessKeyId);
                        localStorage.setItem("aws_s",c.SecretAccessKey);
                        localStorage.setItem("aws_t",c.SessionToken);
                        next(c);
                    }
                });
            }
        });
    }

    me.clearTokens = function(){
        localStorage.removeItem("aws_a");
        localStorage.removeItem("aws_s");
        localStorage.removeItem("aws_t");
    }

    return me;
}

export default Auth();