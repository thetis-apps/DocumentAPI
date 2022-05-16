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
    let response = await ims.get('documents/' + document.id + '/globalTradeItemsToReplenish');
    let gtis = response.data;
    for (let gti of gtis) {
        gti.replenishFromLots = JSON.parse(gti.replenishFromLots);
    }
    document.globalTradeItemsToReplenish = gtis;
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
    let lines = response.data;
    for (let line of lines) {
        line.pickFromLots = JSON.parse(line.pickFromLots);
    }
    document.shipmentLinesToPack = lines;
    
}

async function extendStockTakingList(ims, document) {
    let response = await ims.get('documents/' + document.id + '/stockTakingLinesToDo');
    document.stockTakingLinesToDo = response.data;
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

exports.getPendingStockTakingLists = async (event, context) => {
    try {
        
        let ims = await getIMS();

        let documents = await getPendingDocuments(ims, 'STOCK_TAKING_LIST', 10);
        
        for (let i = 0; i < documents.length; i++) {
            let document = documents[i];
            await extendStockTakingList(ims, document);            
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
            if (lot.done) {
                await ims.patch('globalTradeItemLots/' + lot.id, { locationNumber: lot.globalTradeItemLocationNumber });
            }
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
            let lots = line.replenishFromLots;
            for (let lot of lots) {
                if (lot.numItemsReplenished > 0) {
                    
                    let lotForPickingId = line.lotForPickingId;
                    if (lotForPickingId != null && line.replenishToExistingLot) {
                    
                        let params = new Object();
                        params.sourceLotId = lot.id;
                        params.targetLotId = lotForPickingId;
                        params.numItems = lot.numItemsReplenished;
                        let response = await ims.post('invocations/splitToExistingLot', params, { validateStatus: function (status) {
                			    return status >= 200 && status < 300 || status == 422; 
                			}});
                			
                        if (response.status == 422) {
                            let message = new Object();
                    		message.time = Date.now();
                    		message.source = "DocumentApi";
                    		message.messageType = response.data.messageType;
                    		message.messageText = 'Failed to split to existing lot. Reason: ' + response.data.messageText;
                    		await ims.post("events/" + replenishmentList.documentCreatedEventId + "/messages", message);
                        }

                    } else {
                        
                        let params = new Object();
                        params.globalTradeItemLotId = lot.id;
                        params.locationNumber = line.locationNumber;
                        params.lotStatus = 'SALEABLE';
                        params.numItems = lot.numItemsReplenished;
                        let response = await ims.post('invocations/splitToNewLot', params, { validateStatus: function (status) {
                			    return status >= 200 && status < 300 || status == 422; 
                			}});

                        if (response.status == 422) {
                            let message = new Object();
                    		message.time = Date.now();
                    		message.source = "DocumentApi";
                    		message.messageType = response.data.messageType;
                    		message.messageText = 'Failed to split to new lot. Reason: ' + response.data.messageText;
                    		await ims.post("events/" + replenishmentList.documentCreatedEventId + "/messages", message);
                        }
                    }
                    
                }
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
        
        // Write to error log
        
        // Nothing should be allowed to go wrong!!
        
        console.log(err);
        return err;
        
    }
    
};

exports.putStockTakingList = async (event, context) => {
    
    try {
        
        let ims = await getIMS();
        
        const documentId = event.pathParameters.id;
        
        let stockTakingList = JSON.parse(event.body);
        
        let workStatus = stockTakingList.workStatus;
        
        let lines = stockTakingList.stockTakingLinesToDo;
        for (let line of lines) {
            if (line.counted) {
                await ims.patch('stockTakingLines/' + line.id, { counted: true, numItemsCounted: line.numItemsCounted });
            }
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
