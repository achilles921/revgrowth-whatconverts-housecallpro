/* global fetch */

/**
 * HouseCallPro API Client
 * Handles creating and updating customers, jobs, and estimates in HouseCallPro
 */

export class HouseCallProAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.housecallpro.com';
    }

    /**
     * Make an API call to HouseCallPro
     */
    async apiCall(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Authorization': `Token ${this.apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            };

            if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = JSON.stringify(body);
            }

            const url = `${this.baseUrl}${endpoint}`;
            console.log(`HouseCallPro API Call: ${method} ${url}`);
            
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                console.error('HouseCallPro API Error:', data);
                throw new Error(`HouseCallPro API Error: ${response.status} - ${JSON.stringify(data)}`);
            }

            return data;
        } catch (error) {
            console.error('HouseCallPro API Call Failed:', error);
            throw error;
        }
    }

    /**
     * Search for a customer by email or phone
     */
    async findCustomer(email, phone) {
        try {
            // Search by email
            if (email) {
                const emailResult = await this.apiCall(`/customers?q=${encodeURIComponent(email)}`);
                if (emailResult.customers && emailResult.customers.length > 0) {
                    console.log('Customer found by email:', emailResult.customers[0]);
                    return emailResult.customers[0];
                }
            }

            // Search by phone
            if (phone) {
                const phoneResult = await this.apiCall(`/customers?q=${encodeURIComponent(phone)}`);
                if (phoneResult.customers && phoneResult.customers.length > 0) {
                    console.log('Customer found by phone:', phoneResult.customers[0]);
                    return phoneResult.customers[0];
                }
            }

            console.log('No existing customer found');
            return null;
        } catch (error) {
            console.error('Error finding customer:', error);
            return null;
        }
    }

    /**
     * Create a new customer in HouseCallPro
     */
    async createCustomer(customerData) {
        const payload = {
            first_name: customerData.first_name || customerData.name?.split(' ')[0] || 'Unknown',
            last_name: customerData.last_name || customerData.name?.split(' ').slice(1).join(' ') || 'Lead',
            email: customerData.email || null,
            mobile_number: customerData.mobile_number || customerData.phone || null,
            company: customerData.company || null,
            notifications_enabled: customerData.notifications_enabled !== false
        };

        // Add address if provided
        if (customerData.address) {
            payload.addresses = [{
                street: customerData.address.street || null,
                street_line_2: customerData.address.street_line_2 || null,
                city: customerData.address.city || null,
                state: customerData.address.state || null,
                zip: customerData.address.zip || null,
                country: customerData.address.country || 'US',
                type: 'service'
            }];
        }

        console.log('Creating customer with payload:', payload);
        const result = await this.apiCall('/customers', 'POST', payload);
        console.log('Customer created:', result);
        return result.customer;
    }

    /**
     * Update an existing customer in HouseCallPro
     */
    async updateCustomer(customerId, customerData) {
        const payload = {};

        if (customerData.first_name) payload.first_name = customerData.first_name;
        if (customerData.last_name) payload.last_name = customerData.last_name;
        if (customerData.email) payload.email = customerData.email;
        if (customerData.mobile_number || customerData.phone) {
            payload.mobile_number = customerData.mobile_number || customerData.phone;
        }
        if (customerData.company) payload.company = customerData.company;

        console.log('Updating customer with payload:', payload);
        const result = await this.apiCall(`/customers/${customerId}`, 'PUT', payload);
        console.log('Customer updated:', result);
        return result.customer;
    }

    /**
     * Create or update a customer
     */
    async upsertCustomer(customerData) {
        const existingCustomer = await this.findCustomer(
            customerData.email,
            customerData.mobile_number || customerData.phone
        );

        if (existingCustomer) {
            return await this.updateCustomer(existingCustomer.id, customerData);
        } else {
            return await this.createCustomer(customerData);
        }
    }

    /**
     * Create a job/service request in HouseCallPro
     */
    async createJob(customerId, jobData) {
        const payload = {
            customer_id: customerId,
            schedule: jobData.schedule || {
                arrival_window: jobData.arrival_window || null,
                scheduled_start: jobData.scheduled_start || null,
                scheduled_end: jobData.scheduled_end || null
            },
            work_status: jobData.work_status || 'needs_scheduling',
            description: jobData.description || 'Lead from WhatConverts',
            lead_source: jobData.lead_source || 'WhatConverts',
            tags: jobData.tags || []
        };

        console.log('Creating job with payload:', payload);
        const result = await this.apiCall('/jobs', 'POST', payload);
        console.log('Job created:', result);
        return result.job;
    }

    /**
     * Create an estimate in HouseCallPro
     */
    async createEstimate(customerId, estimateData) {
        const payload = {
            customer_id: customerId,
            description: estimateData.description || 'Estimate from WhatConverts',
            lead_source: estimateData.lead_source || 'WhatConverts'
        };

        // Add line items if provided
        if (estimateData.line_items && estimateData.line_items.length > 0) {
            payload.line_items = estimateData.line_items;
        }

        console.log('Creating estimate with payload:', payload);
        const result = await this.apiCall('/estimates', 'POST', payload);
        console.log('Estimate created:', result);
        return result.estimate;
    }

    /**
     * Add a note to a customer
     */
    async addCustomerNote(customerId, note) {
        const payload = {
            customer_id: customerId,
            note: note
        };

        console.log('Adding note to customer:', payload);
        const result = await this.apiCall('/notes', 'POST', payload);
        console.log('Note added:', result);
        return result;
    }
}

