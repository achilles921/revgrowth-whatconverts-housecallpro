/* global fetch */

import { validateAndFormatPhone } from "./phone.mjs";

//initiate parameters
const whatToken = process.env.what_converts_token;
const whatSecret = process.env.what_converts_secret;
const baseUrl = process.env.what_converts_api_link;

//encode the token and secret for Basic Auth
const basicAuth = 'Basic ' + Buffer.from(`${whatToken}:${whatSecret}`).toString('base64');

export async function whatConverts(e) {

    const lead = await getLead(e);
    
    if (lead) {

        const leadId = lead.lead_id
        //calculate sales_value new value
        const currentSalesValue = lead.sales_value;
        
        //calculate new sales value
        let newSalesValue;
        if (currentSalesValue) {
            newSalesValue = currentSalesValue + e.value;
        } else {
            newSalesValue = e.value;
        }

        await updateLead(leadId, newSalesValue)
        return true
    }
    return false
    
}

export async function getLead(e) {
    
    const phone = e?.phone
    const email = e?.email

    //get today's date
    const today = new Date();
    
    //subtract 399 days from today
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 399);
    
    // Convert to ISO 8601 format (UTC) without milliseconds
    const startDate = pastDate.toISOString().split('.')[0] + 'Z';
    
    //try with phone number first
    if (phone) {

        //validate and format phone number to e164
        const phoneFormatted = await validateAndFormatPhone(phone)
        // console.log(phoneFormatted)

        //if phone number valid proceed with lead lookup using phone number
        if (phoneFormatted) {
            let url = new URL(baseUrl);
            //assemble parameters
            let params = {
                "lead_status": "unique",
                "profile_id": e.profileId,
                "start_date": startDate,
                "phone_number": phoneFormatted
            };
            //append the query parameters
            Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            const phoneTry = await apiCall(url, 'GET');
            //if leads array is not empty return the lead
            if (phoneTry.leads && phoneTry.leads.length) {
                console.log('lead found by phone: ', phoneTry.leads[0])
                return phoneTry.leads[0];
            }
            //if leads array is empty the script will proceed to email try
            console.log('phone lookup - leads array is empty')
        } else {
            //if phone number is invalid the script will proceed to email try
            console.log('phone number provided is invalid')
        }

    }
    
    //try with email
    if (email) {
        let url = new URL(baseUrl);
        
        //assemble parameters
        let params = {
            "lead_status": "unique",
            "profile_id": e.profileId,
            "start_date": startDate,
            "email_address": email
        };
        
        //append the query parameters
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        
        const emailTry = await apiCall(url, 'GET');
        
        //if leads array is not empty return the lead
        if (emailTry.leads && emailTry.leads.length) {
            console.log('lead found by email: ', emailTry.leads[0])
            return emailTry.leads[0];
        } else {
            //no lead with such phone and/or email exists on whatconverts
            console.log('no lead with such phone and/or email exists on whatconverts')
            return false
        }
    } else {
        //no lead with such phone number and/or no email provided
        console.log('no lead with such phone number and/or no email provided')
        return false
    }
    
}

export async function updateLead(leadId, value) {
    
    let url = new URL(baseUrl);
    
    //update the pathname by appending the leadId
    url.pathname += `/${leadId}`;
    
    //create form data object to hold parameters
    let formData = new FormData();
    formData.append('sales_value', value);
    //send new data to whatconverts
    const newData = await apiCall(url, 'POST', formData);
    console.log('lead updated: ', newData)
    
    return newData;
}

export async function updateQuoteValue(leadId, value) {
    
    let url = new URL(baseUrl);
    
    //update the pathname by appending the leadId
    url.pathname += `/${leadId}`;
    
    //create form data object to hold parameters
    let formData = new FormData();
    formData.append('quote_value', value);
    //send new data to whatconverts
    const newData = await apiCall(url, 'POST', formData);
    console.log('lead updated: ', newData)
    
    return newData;
}

export async function readLead(leadId) {
    
    let url = new URL(baseUrl);
    
    //update the pathname by appending the leadId
    url.pathname += `/${leadId}`;
    
    const leadData = await apiCall(url, 'GET');
    if (leadData.leads && leadData.leads.length) {
        return leadData.leads[0];
    } else {
        throw new Error('No lead found with id: ' + leadId);
    }
}

async function apiCall(url, method, formData) {
    try {
        
        //define the options for the fetch call
        const options = {
            method: method,
            headers: {
                'Authorization': basicAuth
            }
        };
        
        //attach form data to the body only for POST requests
        if (method === 'POST' && formData) {
            options.body = formData;
        }
        
        const res = await fetch(url, options);
    
        //parse and return the response as JSON
        const data = await res.json();
        return data;
    }
    
    catch (e) {
        console.error(e);
        return 500;
    }
}