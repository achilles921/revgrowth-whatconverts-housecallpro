import { parsePhoneNumber } from 'libphonenumber-js'

export async function validateAndFormatPhone(phone) {
    const phoneNumber = parsePhoneNumber(phone, 'US')

    //if valid - format it to national number (10 digits for US), if not return false
    if (phoneNumber) {
        // Return just the national number without country code (10 digits for US)
        return phoneNumber.nationalNumber
    } else {
        return false
    }
}