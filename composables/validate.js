import Joi from 'joi'
import { translate } from './translate'

/**
 * Return custom messages for Joi validation errors, based on the
 * standard ErrorCodes generated by the Joi validation schemas.
 *
 * @param {string} field - Descriptive name of the input field
 * @param {string} type - the Joi type of the field (string, number, date)
 * @param {Array} errors - List of Joi errors (base, email, empty, max)
 * @returns {Object}
 */
export function getJoiMessage(field, type, errors) {
  let errorObject = {}
  // Add '*.base' error message
  errorObject[`${type}.base`] = `${type}.base,${field}`

  // Loop through message array, if any
  if (errors && errors.length > 0) {
    for (const error of errors) {
      // some errors may include a limit number (min3, max8)
      const limit = error.match(/[\d-]*$/)[0]
      const err = error.match(/^[^\d-]*/)[0]
      const errorCode = err === 'required' ? 'any.required' : `${type}.${err}`
      const translationKey =
        err === 'required' ? 'any_required' : `${type}_${err}`

      // Set errorCode and translation data
      errorObject[errorCode] = `${translationKey},${field}`
      // Add the limit (min3, max8) if any so we can use it in the translation
      if (limit) errorObject[errorCode] += `,${limit}`
    }
  }

  return errorObject
}

/**
 * Validate any fields from a single schema
 * by pulling only the requested keys from it.
 * SERVER-SIDE only
 *
 * @param  {Object} input  - {name: 'John', email: 'jn@wow.com', password: '123'}
 * @param  {Object} schema - The schema used to validate the keys in /schemas
 * @returns array - [{error object}|false, {validated object}|false]
 */
export function validate(input, schema) {
  let keysObject = {}
  let schemaObject = {}

  // Loop through input keys, building keysObject and schemaObject
  for (let key of Object.keys(input)) {
    if (!(key in schema)) {
      console.warn(`ERROR in validate.js: '${key}' key not found in schema.`)
      return [
        {
          details: [{ message: 'unknownError', context: { key: key } }],
        },
        false,
      ]
    }

    keysObject[key] = input[key]
    schemaObject[key] = schema[key]
  }

  // Validate the custom schema using the extracted input.
  //   abortEarly: false = Return all errors.
  //   convert: true = Schema options like .custom(), .trim() and .lowercase()
  //   will alter the validated data that is returned.
  const result = Joi.object(schemaObject)
    .options({ abortEarly: false, convert: true })
    .validate(keysObject)

  console.log('errors=', result.error)

  return [result.error || false, result.value || false]
}

/**
 * Generate a response object from the messages list.
 * Usage: return response('success, created, user', data)
 *
 * @param  {string} keyString - 'status, code, field'
 * @param  {any}    details - Optional data, such as row id or row data
 *
 * @returns {Object} An object containing message information
 */
export function response(keyString, details = null) {
  const [status, code, field] = keyString.replace(/\s+/g, '').split(',')

  const responseObject = {
    status: status,
    code: code,
    field: field,
    details: details,
  }
  // Log the server error somewhere
  if (status === 'error') console.log(responseObject)

  return responseObject
}

/**
 * Get Error Message(s) from Joi validation
 *
 * @export
 * @param {Object} validationErrors
 * @returns {Object}
 */
export function getErrorMessages(validationErrors) {
  return validationErrors.details.reduce((err, detail) => {
    const [code, field, limit = null] = detail.message.split(',')
    err[detail.context.key] = translate(code, field, limit, true)
    return err
  }, {})
}

/**
 * Validate a single field and return a string error message or boolean 'true'
 * This is for Client-side validation.
 *
 * @param  {string} key
 * @param  {string} value
 * @param  {Object} schema - The schema used to validate the keys in /schemas
 * @returns {string|boolean}
 */
export function validateField(key, value, schema) {
  const field = { [key]: value }
  const [vErr, v] = validate(field, schema)

  if (vErr && vErr.details) {
    const [code, field, limit = null] = vErr.details[0].message.split(',')
    return translate(code, field, limit, true)
  }
  return true
}
