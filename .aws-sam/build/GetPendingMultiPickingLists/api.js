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

    console.log(clientId + " - " + clientSecret);
    
    console.log(apiKey);

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

async function extendReplenishmentList(ims, document) {
    let response = await ims.get('documents/' + document.id);
    document.globalTradeItemsToReplenish = response.data;
}

async function extendPurchaseProposal(ims, document) {
    let response = await ims.get('documents/' + document.id + '/globalTradeItemsToOrder');
    document.globalTradeItemsToOrder = response.data;
}

async function extendPutAwayList(ims, document) {
    let response = await ims.get('documents/' + document.id + '/globalTradeItemLotsToPutAway');
    document.globalTradeItemLotsToPutAway = response.data;
}

async function extendMultiPickingList(ims, document) {
    let response = await ims.get('documents/' + document.id + '/shipmentLinesToPack');
    document.shipmentLinesToPack = response.data;
}

async function getPendingDocuments(ims, documentType, maxNumRows) {
    let documentFilter = new Object();
    documentFilter.documentType = documentType;
    documentFilter.workStatus = 'PENDING';
    documentFilter.maxNumRows = maxNumRows;
    documentFilter.onlyNotCancelled = true;
    let response = await ims.get('documents', { params: documentFilter });
    return response.data;
}

exports.getPendingMultiPickingLists = async (event, context) => {
    try {
        
        let ims = await getIMS();

        let documents = await getPendingDocuments(ims, 'MULTI_PICKING_LIST', 10);
        
        for (let i = 0; i < documents.length; i++) {
            let document = documents[i];
            await extendMultiPickingList(ims, document);            
        }

        let response = {
            'statusCode': 200,
            'body': JSON.stringify(documents),
            'headers': {
                'Access-Control-Allow-Origin': '*'
            }
        }

        return response;
        
    } catch (err) {
        console.log(err);
        return err;
    }

};

exports.getPendingPutAwayLists = async (event, context) => {
    try {
        
        let ims = await getIMS();

        let documents = await getPendingDocuments(ims, 'PUT_AWAY_LIST', 10);
        
        for (let i = 0; i < documents.length; i++) {
            let document = documents[i];
            await extendPutAwayList(ims, document);            
        }

        let response = {
            'statusCode': 200,
            'body': JSON.stringify(documents),
            'headers': {
                'Access-Control-Allow-Origin': '*'
            }
        }

        return response;
        
    } catch (err) {
        console.log(err);
        return err;
    }

};

exports.getPendingReplenishmentLists = async (event, context) => {
    try {
        
        let ims = await getIMS();

        let documents = await getPendingDocuments(ims, 'REPLENISHMENT_LIST', 10);
        
        for (let i = 0; i < documents.length; i++) {
            let document = documents[i];
            await extendReplenishmentList(ims, document);            
        }

        let response = {
            'statusCode': 200,
            'body': JSON.stringify(documents),
            'headers': {
                'Access-Control-Allow-Origin': '*'
            }
        }

        return response;
        
    } catch (err) {
        console.log(err);
        return err;
    }

};

exports.putMultiPickingList = async (event, context) => {
    
    try {
        
        let ims = await getIMS();
        
        const documentId = event.pathParameters.id;
        
        let multiPickingList = JSON.parse(event.body);
        
        let workStatus = multiPickingList.workStatus;
        
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

exports.putPutAwayList = async (event, context) => {
    
    try {
        
        let ims = await getIMS();
        
        const documentId = event.pathParameters.id;
        
        let putAwayList = JSON.parse(event.body);
        
        let workStatus = putAwayList.workStatus;
        
        let lots = putAwayList.globalTradeItemLotsToPutAway;
        for (let lot of lots) {
            await ims.patch('globalTradeItemLots/' + lot.globalTradeItemLotId, { locationNumber: lot.locationNumber });
        }

        let response = await ims.put('/documents/' + documentId + '/workStatus', workStatus);
        let document = response.data;
        await extendPutAwayList(ims, document);
        
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

exports.putReplenishmentList = async (event, context) => {
    
    try {
        
        let ims = await getIMS();
        
        const documentId = event.pathParameters.id;
        
        let replenishmentList = JSON.parse(event.body);
        
        let lines = replenishmentList.globalTradeItemsToReplenish;
        for (let line of lines) {
            if (line.picked && line.placed) {
                
            }
        }
        
        let workStatus = replenishmentList.workStatus;
        
        let response = await ims.put('/documents/' + documentId + '/workStatus', workStatus);
        let document = response.data;
        await extendReplenishmentList(ims, document);
        
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

exports.postPutAwayListReport = async (event, context) => {

    try {
        
        let ims = await getIMS();
        
        let report = JSON.parse(event.body);

        for (let entry of report) {
            await ims.patch('globalTradeItemLots/' + entry.globalTradeItemLotId, { locationNumber: entry.locationNumber });
        }

        let response = {
            'statusCode': 200,
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

exports.postReplenishmentReport = async (event, context) => {
    
    
}

