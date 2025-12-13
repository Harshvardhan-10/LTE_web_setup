# LTE Frontend Backend Documentation

Tags: LTE

## **Project Overview**

This project implements real-time data transmission from an LTE module to a web application. The LTE module sends data via HTTP POST requests to a backend server hosted on an AWS EC2 instance. The server relays this data to a React-based web application using WebSockets. Additionally, users can interact with the web app through a form to send messages via the same WebSocket. After achieving this, implemented a MySQL database to store the data being received.

## Step 1: Launching an AWS EC2 instance

- Log in to the AWS Management Console.
- Go to **EC2** and click **Launch Instance**.
- Under Name and tags tab, enter a suitable name.
- Under Application and OS Images (Amazon Machine Image) tab, choose an **Amazon Linux 2023** AMI, whichever is free tier eligible.
- Under Instance type tab, select a free tier eligible instance type. For our purpose, 2 vCPU & 1 GiB memory instance type suffices(and is cheap) so go ahead with that.
- Under Key pair (login) tab, select create a new key pair, enter suitable name (this will be the name of the .pem/.ppk file), select RSA key pair type, and choose either private key file format. <br>For simplicity go with .pem, which will avoid you the trouble of setting up PuTTY (though as weird/cute as it may sound). When prompted, store the private key in a secure and accessible location on your computer. You will need it later to connect to your instance.<br><br>
Also note that key pair type is how you authenticate to the server, so when you SSH, your terminal shows a server host key fingerprint - that's the key the instance itself uses (not yours). So, even though you picked RSA for your own login key, the instance can still use ED25519 (or ECDSA, or RSA) for its host key - and that's fine.<br><br>
**NOTE FOR THE ABOVE STEP**: (For windows users only, mac/linux guide soon) <br>
Though the above step is enough I recommend doing the below steps to make an user friendly setup to work in your virtual machine-
	1. Install latest version of PuTTY from [PuTTY website](putty.org).
	2. After installing, open PuTTYgen (not PuTTY, just search PuTTY on windows search bar and in the preview pane click on run PuTTYgen.
	3. Then follow these exact steps:
		1. Click Load
		2. Select your .pem file (change file type to All Files)
		3. (optional but recommended) Enter a passphrase and make sure to note it.
		4. Click Save private key
		5. Save it.
	4. This should allow you to connect to SSH via PuTTY as well. Though you can skip that and SSH using powershell since WinSCP would need only the .ppk file.
	5. Install latest version of WinSCP from [WinSCP website](https://winscp.net/).
	6. Start WinSCP and configure the following settings:
		1. File protocol- SFTP
		2. Host IP- copy the public IP of the instance
		3. Username- ec2-user
		4. Click on Advanced and then SSH/Authentication, give the .ppk file made before as the private key file.
		5. Click OK followed by Save on the main dialogue. Give any suitable sitename and select OK.
	7. That is it, you are now connected and you can transfer files between you local machine & remoate server, and as well as edit using text files from the interface.
- Configure the network:
	- Open **port 22** for SSH. (It is set by default so dont change that)
	- Open **port 80** (HTTP) and **port 443** (HTTPS) for web access. (These are set by default so no need to change this)
	- Open **port 3000** or any custom port for WebSocket connections. (Add inbound rule as custom TCP, with source IP as 0.0.0.0/0)
- Launch the instance and download the key pair (.pem file) for SSH access. Make sure only your user has access to the .pem file.

**Connect to the Instance**:

- Use SSH to connect to your instance:
    
    ```powershell
    ssh -i your-key.pem ec2-user@<Instance_Public_IP>
    ```
<br>
Note: Replace your-key.pem with the pem file generated, if it is not in the current directory where the terminal is opened then you have to give the complete name. Replace ec2-user with the name of image, if you didnt specifically change it then it is set default to ec2-user. Next replace <Instance_Public_IP> with the Public DNS, which can be seen by going to the aws management console and into the instances section and selecting your instance.<br><br>
(Optional) Verify that the fingerprint in the security alert matches the instance fingerprint contained in the console output when you first start an instance. To get the console output, choose Actions, Monitor and troubleshoot, Get system log. If the fingerprints don't match, someone might be attempting a man-in-the-middle attack. If they match, continue to the next step.
<br><br>

You have now created an EC2 instance, whom you can connect to using SSH, after starting the instance. <br>
**IMPORTANT**: Make sure to stop the instance whenever you are not using it. You are charged for its runtime (as well as stoptime for storage but less expensive).
    

## Step 2: Set up Node.js Backend

- **Install Node.js**:
	- First go to the root directory
    - For Amazon Linux 2:
        
        ```bash
        sudo yum update -y
        sudo yum install -y nodejs npm
        ```
        
- **Create a Node.js WebSocket Server(on the ec2 instance, which you have to SSH into)**:
    - Install dependencies:
        
        ```bash
        mkdir websocket-server
        cd websocket-server
        npm init -y
        npm install ws express
        npm install -g pm2 # if this takes too long, exit with ctrl+C
        npm install pm2 # directly in the folder websocket-server
        ```
        
    - Create the server.js file:
    Code for it is on github
- Start the server
    
    ```bash
    pm2 start server.js # if pm2 installed globally
    # OR
    npx pm2 start server.js # if pm2 installed directly in the websocket-server folder
    
    # use the following if server already running, and want to apply changes made in server.js
    pm2 restart server.js
    # OR
    npx pm2 restart server.js
    ```
    

## Step 3: Set up the React Frontend

I used the Ubuntu downloaded onto my laptop for this part, as it was easier to use

**Initialize a React Project**:

- On your local machine:
    
    ```bash
    npx create-react-app websocket-client
    cd websocket-client
    ```
    
    If npx is not installed run the following commands
    
    ```bash
    sudo apt update
    sudo apt install -y nodejs npm
    ```
    
    then run the previous commands
    
- Edit the  src/App.js file inside the websocket-client folder
- The code for App.js will be uploaded on github, **be sure to change the IP address of the websocket server to the public IP of your EC2 instance.**
- Run the build command to build the frontend (to be ran on your own laptop, not EC2 instance)
    
    ```bash
    npm run build
    ```
    
- This will create a build folder in the websocket-client folder. Which you will have to send to the EC2 instance, and save at the folder location wherever your nginx config file points its root.  ChatGPT told me its standard practice to store it in the folder /var/www/projectname hence I used the following folder /var/www/websocket-client, but it can be where ever you want to keep it.
- On EC2 instance: Run these commands
    
    ```bash
    sudo mkdir -p /var/www/websocket-client
    sudo chmod -R 755 /var/www/websocket-client
    ```
    
- Command to send folder to EC2 instance:
    
    ```bash
    scp -i /path/to/pem -r /path/to/build ec2-user@<your-public-ip>:/var/www/websocket-client
    
    # -r means recursive, required while transferring folders, for single files not needed.
    
    # If this doesn't work directly, first transfer the folder to the home directory of EC2, 
    # then use sudo mv command there
    
    scp -i /path/to/pem -r /path/to/build ec2-user@<your-public-ip>:/home/ec2-user
    sudo mv build /var/www/websocket-client # or whatever your folder name is
    ```
    
- Setting up NGINX: (on EC2 instance)
    - installing nginx
        
        ```bash
        sudo yum install nginx -y   # For Amazon Linux
        sudo apt install nginx -y   # For Ubuntu
        ```
        
    - Configuring nginx:
        
        ```bash
        sudo nano /etc/nginx/conf.d/websocket-client.conf
        ```
        
        - After you have transferred the build folder onto your EC2 instanec, add following configuration: change folder name accordingly
        
        ```bash
        server {
            listen 80;
            server_name <Instance_Public_IP>;
        
            root /path/to/build/folder/on/EC2;
            index index.html;
        
            location / {
                try_files $uri /index.html;
            }
        }
        ```
        
    - Restart nginx
        
        ```bash
        sudo systemctl restart nginx
        ```
        
- Now you should be able to access the basic web app created on the link http://<public-ip-address>

What ever you put in your App.js as `console.log()` can be seen in the console of the web app, accessed by F12 on chrome (windows). Wherever `console.log` is used in server.js, logs can be accessed by running the command `pm2 logs`  or `npx pm2 logs` in your ec2 instance terminal.

For any errors that come in the logs, ChatGPT is your friend.

Next step is to setup a database, to store the values which we will receive from the LTE module.

## Database Setup:

I used MySQL AWS RDS database for this part.

Follow this link: [https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.MySQL.html#CHAP_GettingStarted.Creating.MySQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.CreatingConnecting.MySQL.html#CHAP_GettingStarted.Creating.MySQL)

Be sure to choose the free tier option in the setup.

Keep the names of the Database etc as you wish. 

- Connecting to database:
    
    ```bash
    mysql -h <aws-rds-endpoint> -u your_username -p # Then enter your password
    ```
    

Then after connecting to the MYSQL DB instance from the command line, You can use the database you have created an You can create a table to store your data, using command.

```bash
USE <whatever-your-database-name-is>;

CREATE TABLE your_table_name (
    id INT AUTO_INCREMENT PRIMARY KEY, # this is like a serial number, starts from 1
    column1 datatype,
    column2 datatype,
    ... # as many columns as you want
);

# To see all the data stored
SELECT * FROM your_table_name
```

On changing any details of the database, make sure the relevant changes are done in the `server.js` file.

There will be a part of code like this:

```bash
const db = mysql.createConnection({
    host: "your-rds-endpoint",
    user: "your-username",
    password: "your-password",
    database: "lte_database", // Use correct database name
});

```

I have implemented a practice called secure credential management into my code, so in my code it will be like

```bash
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});
```

And the changes in the details are done in the .env file, which will be in the same folder as that of websocket-server.

My .env file looks like, 

```bash
DB_HOST=<rds-endpoint>
DB_USER=<database-user>
DB_PASSWORD=<database-password>
DB_NAME=<database-name>
PORT=<websocket-port>
AWS_IOT_KEY_PATH=<IOT-private-key-path-to-folder>   # file end with .pem.key
AWS_IOT_CERT_PATH=<IOT-certificate-path-to-folder> # file end with .pem.crt
AWS_IOT_CA_PATH=<IOT-CA-certificate-path-to-folder> # file name AmazonRootCA1.pem
AWS_IOT_CLIENT_ID=<name-of-thing-on-aws-IoT>
AWS_IOT_ENDPOINT=<aws-endpoint-link>
```

The AWS_IOT stuff is for the MQTT protocol setup I have done, will be discussed ahead.

<aside>
💡

Note: If your database, exceeds the free tier limits, AWS doesn’t stop the service, but rather enforces a pay as you use policy, they will upgrade your tier, start billing you by hours, so be sure to not exceed the free tier limits else you might incur charges you weren’t expecting.

To avoid this setup a few, billing alerts, and monitoring systems on AWS,

Some AWS services that you can use for this are Amazon CloudWatch billing alerts and alarms, AWS Budgets, AWS CloudTrail, and AWS Cost Anomaly Detection. For more information, see the following links:

[https://aws.amazon.com/cloudtrail/getting-started/](https://aws.amazon.com/cloudtrail/getting-started/)

[https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-cloudwatch.html](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-cloudwatch.html)

[https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/budgets-managing-costs.html](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/budgets-managing-costs.html)

[https://aws.amazon.com/aws-cost-management/aws-cost-anomaly-detection/](https://aws.amazon.com/aws-cost-management/aws-cost-anomaly-detection/)

[https://aws.amazon.com/premiumsupport/knowledge-center/free-tier-charges/](https://aws.amazon.com/premiumsupport/knowledge-center/free-tier-charges/)

</aside>

# MQTT setup:

But of knowledge about MQTT:

MQTT, or MQ Telemetry Transport, is

**an open, standards-based protocol for machine-to-machine (M2M) and Internet of Things (IoT) communication:**

- **Purpose:** MQTT is used to efficiently exchange real-time data between devices and applications. It's the primary protocol for communicating with Platform Service.
- **How it works:** MQTT uses a publish-and-subscribe (Pub/Sub) model to connect devices. The sender (publisher) and receiver (subscriber) communicate via topics, and the MQTT broker handles the connection between them.

**Features:**

MQTT is lightweight, bandwidth-efficient, and easy to implement. It supports messaging between devices to the cloud and vice versa.

For MQTT, you need a “broker” and a topic to publish your messages to and subscribe from. 

There are many brokers available which you can find with a quick google search, but I chose the AWS IoT core MQTT Broker, due to everything already being AWS.

First step is to create the necessary AWS IoT resources required to establish MQTT protocol connection.

Link: [https://docs.aws.amazon.com/iot/latest/developerguide/create-iot-resources.html](https://docs.aws.amazon.com/iot/latest/developerguide/create-iot-resources.html)

Above link is for steps to creating the required policy document and obtain the certificates used to establish connection.

Then proceed to next link

[https://docs.aws.amazon.com/iot/latest/developerguide/connecting-to-existing-device.html](https://docs.aws.amazon.com/iot/latest/developerguide/connecting-to-existing-device.html)

The above is a AWS official documentation on how to proceed. 

You will have to store the certificates in a certs folder in your server side folder.

Update .env file of server side as per your file paths, endpoint etc. And then the system should work.
