import { HouseCallProAPI } from "./housecallpro-api.mjs";
import { validateAndFormatPhone } from "./phone.mjs";
import { readLead } from "./converts.mjs";


const houseCallProApiKey = process.env.hosecallpro_api_key;

export const handler = async (event) => {
    try {
        console.log('Processing WhatConverts webhook event:', JSON.stringify(event));

        // Extract lead data from WhatConverts webhook
        const leadId = event.lead_id;
        
        // Get profile ID to look up the integration settings
        const profileId = event.profile_id;
        
        if (!profileId) {
            console.error('No profile_id found in webhook event');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'profile_id is required' })
            };
        }
        if (profileId != 129575) {
            console.log('Accept webhook only from Coastal Carolina Comfort');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Accept webhook only from Coastal Carolina Comfort' })
            };
        }
        if (event.lead_type != "Web Form") {
            console.log('Accept lead from Web Form only');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Accept lead from Web Form only' })
            };
        }

        if (!houseCallProApiKey) {
            console.error('HouseCallPro API key not configured');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'HouseCallPro API key not configured' })
            };
        }

        // Initialize HouseCallPro API client
        const hcpApi = new HouseCallProAPI(houseCallProApiKey);

        const leadData = await readLead(leadId);
        
        // Extract customer information from WhatConverts lead
        const customerData = extractCustomerData(leadData);

        if (!customerData.email && !customerData.mobile_number) {
            console.error('Lead must have either email or phone number');
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Lead must have either email or phone number' })
            };
        }

        // Format phone number if provided
        if (customerData.mobile_number) {
            const formattedPhone = await validateAndFormatPhone(customerData.mobile_number);
            if (formattedPhone) {
                customerData.mobile_number = formattedPhone;
            }
        }

        // Create or update customer in HouseCallPro
        console.log('Creating/updating customer in HouseCallPro:', customerData);
        const customer = await hcpApi.upsertCustomer(customerData);
        console.log('Customer upserted successfully:', customer);
        
        // Build lead data with job description and tags
        const leadDescription = buildJobDescription(leadData);
        const leadTags = buildTags(leadData);

        const leadPayload = {
            description: leadDescription,
            lead_source: leadData.lead_source || 'WhatConverts',
            tags: leadTags
        };

        // Create lead in HouseCallPro using customer ID
        console.log('Creating lead in HouseCallPro for customer:', customer.id);
        const lead = await hcpApi.createLead(customer.id, leadPayload);
        console.log('Lead created successfully:', lead);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Lead processed successfully',
                customerId: customer.id,
                leadId: lead.id
            })
        };

    } catch (error) {
        console.error('Error processing WhatConverts webhook:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to process webhook',
                message: error.message
            })
        };
    }
};

/**
 * State name to abbreviation mapping
 */
const STATE_ABBREVIATIONS = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
    'District of Columbia': 'DC', 'Puerto Rico': 'PR', 'Guam': 'GU', 'American Samoa': 'AS',
    'U.S. Virgin Islands': 'VI', 'Northern Mariana Islands': 'MP'
};

/**
 * Convert state name to 2-letter abbreviation
 */
function normalizeState(state) {
    if (!state) return null;
    
    // If already 2 letters, return as is
    if (state.length === 2) {
        return state.toUpperCase();
    }
    
    // Look up full state name (case insensitive)
    const stateName = Object.keys(STATE_ABBREVIATIONS).find(
        key => key.toLowerCase() === state.toLowerCase()
    );
    
    return stateName ? STATE_ABBREVIATIONS[stateName] : state;
}

/**
 * Extract customer data from WhatConverts lead
 */
function extractCustomerData(leadData) {
    const customerData = {
        first_name: leadData.contact_name?.split(' ')[0] || leadData.first_name || 'Unknown',
        last_name: leadData.contact_name?.split(' ').slice(1).join(' ') || leadData.last_name || 'Lead',
        email: leadData.email_address || leadData.email || null,
        mobile_number: leadData.phone_number || leadData.caller_id || leadData.phone || null,
        company: leadData.company_name || null,
        notifications_enabled: true
    };

    // Extract address if available
    if (leadData.address || leadData.city || leadData.state || leadData.zip) {
        customerData.address = {
            street: leadData.address || leadData.street || null,
            street_line_2: leadData.address_2 || null,
            city: leadData.city || null,
            state: normalizeState(leadData.state),
            zip: leadData.zip || leadData.postal_code || null,
            country: leadData.country || 'US'
        };
    }

    return customerData;
}

/**
 * Extract job/service request data from WhatConverts lead
 */
function extractJobData(leadData) {
    const jobData = {
        description: buildJobDescription(leadData),
        lead_source: leadData.lead_source || 'WhatConverts',
        work_status: 'needs_scheduling',
        tags: buildTags(leadData)
    };

    return jobData;
}

/**
 * Build job description from lead data
 */
function buildJobDescription(leadData) {
    let description = 'New lead from WhatConverts\n\n';

    if (leadData.lead_type) {
        description += `Lead Type: ${leadData.lead_type}\n`;
    }

    if (leadData.lead_source) {
        description += `Source: ${leadData.lead_source}\n`;
    }

    if (leadData.lead_medium) {
        description += `Medium: ${leadData.lead_medium}\n`;
    }

    if (leadData.landing_page) {
        description += `Landing Page: ${leadData.landing_page}\n`;
    }

    if (leadData.referring_url) {
        description += `Referrer: ${leadData.referring_url}\n`;
    }

    if (leadData.quoted_service || leadData.service_type) {
        description += `Service: ${leadData.quoted_service || leadData.service_type}\n`;
    }

    if (leadData.additional_fields) {
        description += '\nAdditional Information:\n';
        Object.entries(leadData.additional_fields).forEach(([key, value]) => {
            description += `${key}: ${value}\n`;
        });
    }

    if (leadData.lead_value) {
        description += `\nLead Value: $${leadData.lead_value}\n`;
    }

    if (leadData.quote_value) {
        description += `Quote Value: $${leadData.quote_value}\n`;
    }

    return description.trim();
}

/**
 * Build tags from lead data
 */
function buildTags(leadData) {
    const tags = ['WhatConverts'];

    if (leadData.lead_type) {
        tags.push(leadData.lead_type);
    }

    if (leadData.lead_source) {
        tags.push(leadData.lead_source);
    }

    if (leadData.campaign) {
        tags.push(leadData.campaign);
    }

    return tags;
}

/**
 * Extract notes from lead data
 */
function extractNotesFromLead(leadData) {
    let notes = '';

    if (leadData.transcript) {
        notes += `Call Transcript:\n${leadData.transcript}\n\n`;
    }

    if (leadData.form_data) {
        notes += 'Form Data:\n';
        Object.entries(leadData.form_data).forEach(([key, value]) => {
            notes += `${key}: ${value}\n`;
        });
        notes += '\n';
    }

    if (leadData.keywords) {
        notes += `Keywords: ${leadData.keywords}\n`;
    }

    return notes.trim() || null;
}

