/**
 * Copyright 2021 Thetis Apps Aps
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * 
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * 
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
const axios = require('axios');

var AWS = require('aws-sdk');
AWS.config.update({region:'eu-west-1'});

async function getIMS() {

    const authUrl = "https://auth.thetis-ims.com/oauth2/";
    const apiUrl = "https://api.thetis-ims.com/2/";

	let clientId = process.env.ClientId;
	let clientSecret = process.env.ClientSecret;  
	let apiKey = process.env.ApiKey;  

    let credentials = clientId + ":" + clientSecret;
	let base64data = Buffer.from(credentials, 'UTF-8').toString('base64');	
	
	let imsAuth = axios.create({
			baseURL: authUrl,
			headers: { Authorization: "Basic " + base64data, 'Content-Type': "application/x-www-form-urlencoded" },
			responseType: 'json'
		});

    let response = await imsAuth.post("token", 'grant_type=client_credentials');
    let token = response.data.token_type + " " + response.data.access_token;
    
    let ims = axios.create({
    		baseURL: apiUrl,
    		headers: { "Authorization": token, "x-api-key": apiKey, "Content-Type": "application/json" }
    	});
	
	ims.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});
		
    return ims;
}

async function extendMultiPickingList(ims, document) {
    let response = await ims.get('/documents/' + document.id + '/shipmentLinesToPack');
    document.shipmentLinesToPack = response.data;
}

exports.getPendingMultiPickingLists = async (event, context) => {
    
    try {
        
        let ims = await getIMS();

        let documentFilter = new Object();
        documentFilter.documentType = 'MULTI_PICKING_LIST';
        documentFilter.workStatus = 'PENDING';
        documentFilter.maxNumRows = 10;
        let response = await ims.get('/documents', { params: documentFilter });
        let documents = response.data;
        
        for (let i = 0; i < documents.length; i++) {
            let document = documents[i];
            await extendMultiPickingList(ims, document);            
        }

        response = {
            'statusCode': 200,
            'body': JSON.stringify(documents),
            'headers': {
                'Access-Control-Allow-Origin': '*'
            }
        }

        console.log(response.body);

        return response;
        
    } catch (err) {
        console.log(err);
        return err;
    }

};

exports.putMultiPickingListStatus = async (event, context) => {
    
    try {
        
        let ims = await getIMS();
        
        const documentId = event.pathParameters.id;
        
        let workStatus = JSON.parse(event.body);
        
        let response = await ims.put('/documents/' + documentId + '/workStatus', workStatus);
        let document = response.data;
        await extendMultiPickingList(ims, document);
        
        response = {
            'statusCode': 200,
            'body': JSON.stringify(document),
            'headers': {
                'Access-Control-Allow-Origin': '*'
            }
        };
        return response;
    
    } catch (err) {
        console.log(err);
        return err;
    }
    
};

exports.endWork = async (event, context) => {
    
};
